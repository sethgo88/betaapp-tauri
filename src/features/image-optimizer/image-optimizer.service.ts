import { useAuthStore } from "@/features/auth/auth.store";
import { climbImageKey } from "@/features/image-cache/image-cache.keys";
import {
	cacheImage,
	getCachedKeys,
	releaseRef,
} from "@/features/image-cache/image-cache.service";
import { getDb } from "@/lib/db";
import {
	extForBlob,
	type ImagePreset,
	resizeAndCompress,
} from "@/lib/image-utils";
import { supabase as _supabase } from "@/lib/supabase";

// Some tables are not in the generated Supabase types
// biome-ignore lint/suspicious/noExplicitAny: topo tables not in generated types
const supabase = _supabase as any;

const PUBLIC_BUCKET = "route-images";
const CLIMB_BUCKET = "climb-images";
const PUBLIC_MARKER = `/storage/v1/object/public/${PUBLIC_BUCKET}/`;
const POOL_SIZE = 2; // canvas encoding is memory-heavy on phones
/** Keep a re-encode only if it is at least this much smaller than the original. */
const MIN_SAVING = 0.9;

export type ImageTable =
	| "route_images"
	| "wall_images"
	| "wall_topos"
	| "route_topos"
	| "climb_images";

/** One row that points at an image file. */
export type ImageRowRef = {
	table: ImageTable;
	id: string;
	sizeBytes: number | null;
	climbId?: string;
};

/**
 * One storage object plus every row that references it. A topo can reuse a
 * gallery image, so the same file may be referenced from several tables; it is
 * processed once and all rows are repointed together.
 */
export type ImageGroup = {
	bucket: string;
	path: string;
	preset: ImagePreset;
	rows: ImageRowRef[];
};

export type OptimizeBackend = {
	listGroups(): Promise<ImageGroup[]>;
	download(bucket: string, path: string): Promise<Blob>;
	upload(bucket: string, path: string, blob: Blob): Promise<void>;
	remove(bucket: string, path: string): Promise<void>;
	encode(blob: Blob, preset: ImagePreset): Promise<Blob>;
	/** Repoint every row to the new file (remote + local) and refresh local caches. */
	applyNewFile(group: ImageGroup, newPath: string, blob: Blob): Promise<void>;
	/** Store the size of an unchanged file on every row. */
	recordSize(group: ImageGroup, sizeBytes: number): Promise<void>;
};

export type OptimizeProgress = { done: number; total: number };

export type OptimizeSummary = {
	reencoded: number;
	sizeBackfilled: number;
	skipped: number;
	failed: { path: string; error: string }[];
	bytesSaved: number;
	cancelled: boolean;
};

export type OptimizePlan = {
	total: number;
	toReencode: number;
	toBackfill: number;
	upToDate: number;
};

const isLegacyFormat = (path: string) => /\.(jpe?g)$/i.test(path);
const needsSize = (g: ImageGroup) => g.rows.some((r) => r.sizeBytes == null);

export function planGroups(groups: ImageGroup[]): OptimizePlan {
	let toReencode = 0;
	let toBackfill = 0;
	for (const g of groups) {
		if (isLegacyFormat(g.path)) toReencode++;
		else if (needsSize(g)) toBackfill++;
	}
	return {
		total: groups.length,
		toReencode,
		toBackfill,
		upToDate: groups.length - toReencode - toBackfill,
	};
}

/**
 * Re-encode legacy JPEG images as small WebP and backfill `size_bytes`.
 * Idempotent: converted rows point at `.webp` files with a size, so a re-run
 * (after a cancel or failure) only does the remaining work. The original file
 * is deleted only after every referencing row has been repointed.
 */
export async function runOptimization(
	backend: OptimizeBackend,
	options: {
		signal?: AbortSignal;
		onProgress?: (p: OptimizeProgress) => void;
	} = {},
): Promise<OptimizeSummary> {
	const { signal, onProgress } = options;
	const groups = (await backend.listGroups()).filter(
		(g) => isLegacyFormat(g.path) || needsSize(g),
	);
	const summary: OptimizeSummary = {
		reencoded: 0,
		sizeBackfilled: 0,
		skipped: 0,
		failed: [],
		bytesSaved: 0,
		cancelled: false,
	};

	let next = 0;
	let done = 0;
	onProgress?.({ done, total: groups.length });

	const process = async (group: ImageGroup) => {
		const original = await backend.download(group.bucket, group.path);

		if (isLegacyFormat(group.path)) {
			const encoded = await backend.encode(original, group.preset);
			if (
				extForBlob(encoded) === "webp" &&
				encoded.size < original.size * MIN_SAVING
			) {
				const newPath = group.path.replace(/\.[^./]+$/, ".webp");
				await backend.upload(group.bucket, newPath, encoded);
				try {
					await backend.applyNewFile(group, newPath, encoded);
				} catch (err) {
					await backend.remove(group.bucket, newPath).catch(() => {});
					throw err;
				}
				await backend.remove(group.bucket, group.path).catch(() => {
					// Orphaned original is harmless; rows already point at the new file
				});
				summary.reencoded++;
				summary.bytesSaved += original.size - encoded.size;
				return;
			}
		}

		// Already small / no worthwhile saving: keep the file, just record its size
		await backend.recordSize(group, original.size);
		summary.sizeBackfilled++;
	};

	const worker = async () => {
		while (!signal?.aborted) {
			const group = groups[next++];
			if (!group) return;
			try {
				await process(group);
			} catch (err) {
				summary.failed.push({
					path: group.path,
					error: err instanceof Error ? err.message : String(err),
				});
			}
			done++;
			onProgress?.({ done, total: groups.length });
		}
	};
	await Promise.all(Array.from({ length: POOL_SIZE }, worker));
	summary.cancelled = signal?.aborted ?? false;
	return summary;
}

// ── Supabase backend ──────────────────────────────────────────────────────────

const LOCAL_TABLE: Record<ImageTable, string> = {
	route_images: "route_images_cache",
	wall_images: "wall_images_cache",
	wall_topos: "wall_topos_cache",
	route_topos: "route_topos_cache",
	climb_images: "climb_images",
};

function publicPath(url: string): string | null {
	return url.includes(PUBLIC_MARKER) ? url.split(PUBLIC_MARKER)[1] : null;
}

async function fetchRows<T>(
	table: string,
	build: (q: ReturnType<typeof supabase.from>) => unknown = (q) => q,
): Promise<T[]> {
	const rows: T[] = [];
	const PAGE = 1000;
	for (let from = 0; ; from += PAGE) {
		const query = build(supabase.from(table).select("*")) as {
			order: (c: string) => {
				range: (
					a: number,
					b: number,
				) => Promise<{ data: T[] | null; error: unknown }>;
			};
		};
		const { data, error } = await query
			.order("id")
			.range(from, from + PAGE - 1);
		if (error) throw error;
		if (!data || data.length === 0) break;
		rows.push(...data);
		if (data.length < PAGE) break;
	}
	return rows;
}

async function remoteUpdate(
	table: ImageTable,
	id: string,
	values: Record<string, unknown>,
): Promise<void> {
	const { error } = await supabase.from(table).update(values).eq("id", id);
	if (error) throw error;
}

async function localUpdate(
	table: ImageTable,
	id: string,
	values: { image_url?: string; size_bytes: number },
): Promise<void> {
	const db = await getDb();
	const sets = Object.keys(values).map((k) => `${k} = ?`);
	await db.execute(
		`UPDATE ${LOCAL_TABLE[table]} SET ${sets.join(", ")} WHERE id = ?`,
		[...Object.values(values), id],
	);
}

export const supabaseBackend: OptimizeBackend = {
	async listGroups() {
		const userId = useAuthStore.getState().user?.id;
		const groups = new Map<string, ImageGroup>();
		const add = (
			bucket: string,
			path: string,
			preset: ImagePreset,
			row: ImageRowRef,
		) => {
			const key = `${bucket}/${path}`;
			const group = groups.get(key) ?? { bucket, path, preset, rows: [] };
			group.rows.push(row);
			groups.set(key, group);
		};

		for (const table of [
			"route_images",
			"wall_images",
			"wall_topos",
			"route_topos",
		] as const) {
			const rows = await fetchRows<{
				id: string;
				image_url: string;
				size_bytes: number | null;
			}>(table);
			for (const r of rows) {
				const path = publicPath(r.image_url);
				if (!path) continue; // external URL — not ours to touch
				add(PUBLIC_BUCKET, path, "reference", {
					table,
					id: r.id,
					sizeBytes: r.size_bytes,
				});
			}
		}

		if (userId) {
			const rows = await fetchRows<{
				id: string;
				climb_id: string;
				image_url: string;
				size_bytes: number | null;
			}>("climb_images", (q) =>
				(q as unknown as { eq: (c: string, v: string) => unknown }).eq(
					"user_id",
					userId,
				),
			);
			for (const r of rows) {
				add(CLIMB_BUCKET, r.image_url, "beta", {
					table: "climb_images",
					id: r.id,
					sizeBytes: r.size_bytes,
					climbId: r.climb_id,
				});
			}
		}
		return [...groups.values()];
	},

	async download(bucket, path) {
		const { data, error } = await supabase.storage.from(bucket).download(path);
		if (error) throw error;
		return data as Blob;
	},

	async upload(bucket, path, blob) {
		const { error } = await supabase.storage.from(bucket).upload(path, blob, {
			contentType: blob.type || "image/webp",
			upsert: true,
		});
		if (error) throw error;
	},

	async remove(bucket, path) {
		const { error } = await supabase.storage.from(bucket).remove([path]);
		if (error) throw error;
	},

	encode(blob, preset) {
		return resizeAndCompress(
			new File([blob], "image", { type: blob.type || "image/jpeg" }),
			preset,
		);
	},

	async applyNewFile(group, newPath, blob) {
		const isPublic = group.bucket === PUBLIC_BUCKET;
		const newUrl = isPublic
			? supabase.storage.from(group.bucket).getPublicUrl(newPath).data.publicUrl
			: newPath;
		for (const row of group.rows) {
			await remoteUpdate(row.table, row.id, {
				image_url: newUrl,
				size_bytes: blob.size,
			});
			await localUpdate(row.table, row.id, {
				image_url: newUrl,
				size_bytes: blob.size,
			});

			// Personal photos cached on disk under the old path: re-key to the new path
			if (row.table === "climb_images" && row.climbId) {
				const oldKey = climbImageKey(group.path);
				const scope = { type: "climb", id: row.climbId };
				if ((await getCachedKeys([oldKey])).has(oldKey)) {
					await cacheImage(climbImageKey(newPath), blob, scope);
					await releaseRef(oldKey, scope);
				}
			}
		}
	},

	async recordSize(group, sizeBytes) {
		for (const row of group.rows) {
			if (row.sizeBytes != null) continue;
			await remoteUpdate(row.table, row.id, { size_bytes: sizeBytes });
			await localUpdate(row.table, row.id, { size_bytes: sizeBytes });
		}
	},
};

export async function scanImages(
	backend: OptimizeBackend = supabaseBackend,
): Promise<OptimizePlan> {
	return planGroups(await backend.listGroups());
}
