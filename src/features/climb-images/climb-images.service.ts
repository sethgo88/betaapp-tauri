import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type {
	ClimbImage,
	ClimbImagePin,
	ClimbImageWithUrl,
	PinType,
	PointerDir,
} from "./climb-images.schema";

const BUCKET = "climb-images";
const SIGNED_URL_TTL = 3600; // 1 hour

// ── Signed URL helpers ────────────────────────────────────────────────────────

async function signUrl(storagePath: string): Promise<string> {
	const { data, error } = await supabase.storage
		.from(BUCKET)
		.createSignedUrl(storagePath, SIGNED_URL_TTL);
	if (error || !data) throw error ?? new Error("Failed to create signed URL");
	return data.signedUrl;
}

// ── Climb images ──────────────────────────────────────────────────────────────

export async function fetchClimbImages(
	climbId: string,
): Promise<ClimbImageWithUrl[]> {
	const db = await getDb();
	const rows = await db.select<ClimbImage[]>(
		"SELECT * FROM climb_images WHERE climb_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC",
		[climbId],
	);
	return Promise.all(
		rows.map(async (row) => ({
			...row,
			signed_url: await signUrl(row.image_url),
		})),
	);
}

export async function getClimbImageSortOrder(climbId: string): Promise<number> {
	const db = await getDb();
	const rows = await db.select<{ count: number }[]>(
		"SELECT COUNT(*) as count FROM climb_images WHERE climb_id = ? AND deleted_at IS NULL",
		[climbId],
	);
	return rows[0]?.count ?? 0;
}

export async function getUserImageCount(userId: string): Promise<number> {
	const db = await getDb();
	const rows = await db.select<{ count: number }[]>(
		"SELECT COUNT(*) as count FROM climb_images WHERE user_id = ? AND deleted_at IS NULL",
		[userId],
	);
	return rows[0]?.count ?? 0;
}

export async function insertClimbImage(
	climbId: string,
	userId: string,
	storagePath: string,
	sortOrder: number,
): Promise<string> {
	const db = await getDb();
	const id = crypto.randomUUID();
	await db.execute(
		`INSERT INTO climb_images (id, climb_id, user_id, image_url, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
		[id, climbId, userId, storagePath, sortOrder],
	);
	return id;
}

export async function softDeleteClimbImage(id: string): Promise<void> {
	const db = await getDb();
	await db.execute(
		"UPDATE climb_images SET deleted_at = datetime('now') WHERE id = ?",
		[id],
	);
}

export async function reorderClimbImages(ids: string[]): Promise<void> {
	const db = await getDb();
	for (let i = 0; i < ids.length; i++) {
		await db.execute("UPDATE climb_images SET sort_order = ? WHERE id = ?", [
			i,
			ids[i],
		]);
	}
}

export async function applyRemoteClimbImage(image: ClimbImage): Promise<void> {
	const db = await getDb();
	await db.execute(
		`INSERT OR REPLACE INTO climb_images
     (id, climb_id, user_id, image_url, sort_order, created_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			image.id,
			image.climb_id,
			image.user_id,
			image.image_url,
			image.sort_order,
			image.created_at,
			image.deleted_at ?? null,
		],
	);
}

// ── Climb image pins ──────────────────────────────────────────────────────────

export async function fetchClimbImagePins(
	climbImageId: string,
): Promise<ClimbImagePin[]> {
	const db = await getDb();
	return db.select<ClimbImagePin[]>(
		"SELECT * FROM climb_image_pins WHERE climb_image_id = ? ORDER BY sort_order ASC",
		[climbImageId],
	);
}

export async function insertClimbImagePin(
	climbImageId: string,
	pinType: PinType,
	xPct: number,
	yPct: number,
	sortOrder: number,
	pointerDir: PointerDir = "bottom",
): Promise<string> {
	const db = await getDb();
	const id = crypto.randomUUID();
	await db.execute(
		`INSERT INTO climb_image_pins (id, climb_image_id, pin_type, x_pct, y_pct, pointer_dir, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
		[id, climbImageId, pinType, xPct, yPct, pointerDir, sortOrder],
	);
	return id;
}

export async function updateClimbImagePin(
	id: string,
	patch: {
		x_pct?: number;
		y_pct?: number;
		description?: string | null;
		pointer_dir?: PointerDir;
	},
): Promise<void> {
	const db = await getDb();
	const sets: string[] = [];
	const params: unknown[] = [];
	if (patch.x_pct !== undefined) {
		sets.push("x_pct = ?");
		params.push(patch.x_pct);
	}
	if (patch.y_pct !== undefined) {
		sets.push("y_pct = ?");
		params.push(patch.y_pct);
	}
	if ("description" in patch) {
		sets.push("description = ?");
		params.push(patch.description ?? null);
	}
	if (patch.pointer_dir !== undefined) {
		sets.push("pointer_dir = ?");
		params.push(patch.pointer_dir);
	}
	if (sets.length === 0) return;
	params.push(id);
	await db.execute(
		`UPDATE climb_image_pins SET ${sets.join(", ")} WHERE id = ?`,
		params,
	);
}

export async function deleteClimbImagePin(id: string): Promise<void> {
	const db = await getDb();
	await db.execute("DELETE FROM climb_image_pins WHERE id = ?", [id]);
}

export async function reorderClimbImagePins(ids: string[]): Promise<void> {
	const db = await getDb();
	for (let i = 0; i < ids.length; i++) {
		await db.execute(
			"UPDATE climb_image_pins SET sort_order = ? WHERE id = ?",
			[i, ids[i]],
		);
	}
}

export async function applyRemoteClimbImagePin(
	pin: ClimbImagePin,
): Promise<void> {
	const db = await getDb();
	await db.execute(
		`INSERT OR REPLACE INTO climb_image_pins
     (id, climb_image_id, pin_type, x_pct, y_pct, description, pointer_dir, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			pin.id,
			pin.climb_image_id,
			pin.pin_type,
			pin.x_pct,
			pin.y_pct,
			pin.description ?? null,
			pin.pointer_dir ?? "bottom",
			pin.sort_order,
			pin.created_at,
		],
	);
}
