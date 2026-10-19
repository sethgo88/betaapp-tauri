import type { Burn } from "@/features/burns/burns.schema";
import type {
	ClimbImage,
	ClimbImagePin,
} from "@/features/climb-images/climb-images.schema";
import {
	applyRemoteClimbImage,
	applyRemoteClimbImagePin,
	uploadPendingImages,
} from "@/features/climb-images/climb-images.service";
export { uploadPendingImages };

import type { Climb } from "@/features/climbs/climbs.schema";
import type {
	RouteImage,
	WallImage,
} from "@/features/route-images/route-images.schema";
import {
	applyRemoteRouteImage,
	applyRemoteWallImage,
} from "@/features/route-images/route-images.service";
import type { RouteLink } from "@/features/routes/routes.schema";
import { applyRemoteRouteLink } from "@/features/routes/routes.service";
import type {
	RouteTopo,
	WallTopo,
	WallTopoLine,
} from "@/features/topos/topos.schema";
import {
	applyRemoteRouteTopo,
	applyRemoteWallTopo,
	applyRemoteWallTopoLine,
	pruneTopoCache,
} from "@/features/topos/topos.service";
import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";

// ── Sync metadata ─────────────────────────────────────────────────────────────

export async function getSyncMeta(): Promise<{
	last_synced_at: string | null;
}> {
	const db = await getDb();
	const rows = await db.select<{ last_synced_at: string | null }[]>(
		"SELECT last_synced_at FROM sync_meta WHERE id = 'singleton'",
	);
	return rows[0] ?? { last_synced_at: null };
}

export async function setSyncMeta(lastSyncedAt: string): Promise<void> {
	const db = await getDb();
	await db.execute(
		"UPDATE sync_meta SET last_synced_at = ? WHERE id = 'singleton'",
		[lastSyncedAt],
	);
}

// ── Push ──────────────────────────────────────────────────────────────────────

// Push local climbs to Supabase. Runs before pull so local changes always win.
// If `since` is provided, only pushes climbs modified after that timestamp (delta).
// Full push (no `since`) is used on first sync to ensure the server is complete.
export async function pushClimbs(
	userId: string,
	since?: string,
): Promise<void> {
	const db = await getDb();
	const climbs = await db.select<Climb[]>(
		since
			? "SELECT * FROM climbs WHERE user_id = ? AND updated_at > ?"
			: "SELECT * FROM climbs WHERE user_id = ?",
		since ? [userId, since] : [userId],
	);
	if (climbs.length === 0) return;

	const { error } = await supabase.from("climbs").upsert(climbs, {
		onConflict: "id",
	});
	if (error) throw error;
}

// ── Pull ──────────────────────────────────────────────────────────────────────

// Pull Supabase climbs and apply locally using INSERT OR REPLACE to preserve
// server timestamps (bypasses the updated_at trigger).
// If `since` is provided, only fetches climbs modified after that timestamp (delta).
export async function pullClimbs(
	userId: string,
	since?: string,
): Promise<void> {
	let query = supabase.from("climbs").select("*").eq("user_id", userId);
	if (since) query = query.gt("updated_at", since);

	const { data, error } = await query;
	if (error) throw error;
	if (!data || data.length === 0) return;

	const db = await getDb();
	for (const row of data) {
		await db.execute(
			`INSERT OR REPLACE INTO climbs
       (id, user_id, name, route_type, grade, moves, sent_status, sent_date,
        country, area, sub_area, crag, wall, route_location, link, route_id,
        rating, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				row.id,
				row.user_id,
				row.name,
				row.route_type,
				row.grade,
				row.moves,
				row.sent_status,
				row.sent_date ?? null,
				row.country ?? null,
				row.area ?? null,
				row.sub_area ?? null,
				row.crag ?? null,
				row.wall ?? null,
				row.route_location ?? null,
				row.link ?? null,
				row.route_id ?? null,
				row.rating ?? null,
				row.created_at,
				row.updated_at,
				row.deleted_at ?? null,
			],
		);
	}
}

// ── Burns push ───────────────────────────────────────────────────────────────

export async function pushBurns(userId: string, since?: string): Promise<void> {
	const db = await getDb();
	const burns = await db.select<Burn[]>(
		since
			? "SELECT * FROM burns WHERE user_id = ? AND updated_at > ?"
			: "SELECT * FROM burns WHERE user_id = ?",
		since ? [userId, since] : [userId],
	);
	if (burns.length === 0) return;

	const { error } = await supabase.from("burns").upsert(burns, {
		onConflict: "id",
	});
	if (error) throw error;
}

// ── Burns pull ───────────────────────────────────────────────────────────────

export async function pullBurns(userId: string, since?: string): Promise<void> {
	let query = supabase.from("burns").select("*").eq("user_id", userId);
	if (since) query = query.gt("updated_at", since);

	const { data, error } = await query;
	if (error) throw error;
	if (!data || data.length === 0) return;

	const db = await getDb();
	for (const row of data) {
		await db.execute(
			`INSERT OR REPLACE INTO burns
       (id, climb_id, user_id, date, outcome, notes, feel,
        created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				row.id,
				row.climb_id,
				row.user_id,
				row.date,
				row.outcome,
				row.notes ?? null,
				row.feel ?? null,
				row.created_at,
				row.updated_at,
				row.deleted_at ?? null,
			],
		);
	}
}

// ── Climb images push/pull (bidirectional — user-owned content) ───────────────

export async function pushClimbImages(
	userId: string,
	since?: string,
): Promise<void> {
	const db = await getDb();
	// Only push rows where the file has been uploaded to storage.
	const images = await db.select<ClimbImage[]>(
		since
			? "SELECT * FROM climb_images WHERE user_id = ? AND created_at > ? AND (upload_status = 'uploaded' OR upload_status IS NULL)"
			: "SELECT * FROM climb_images WHERE user_id = ? AND (upload_status = 'uploaded' OR upload_status IS NULL)",
		since ? [userId, since] : [userId],
	);
	if (images.length === 0) return;

	// local_data is a legacy on-device column and must never be sent to the server
	const rows = images.map(({ local_data: _localData, ...rest }) => rest);
	const { error } = await supabase.from("climb_images").upsert(rows, {
		onConflict: "id",
	});
	if (error) throw error;
}

export async function pullClimbImages(
	userId: string,
	since?: string,
): Promise<void> {
	let query = supabase.from("climb_images").select("*").eq("user_id", userId);
	if (since) query = query.gt("created_at", since);

	const { data, error } = await query;
	if (error) throw error;
	if (!data || data.length === 0) return;

	for (const row of data) {
		await applyRemoteClimbImage(row as ClimbImage);
	}
}

/**
 * Apply server-side changes to the user's existing photos (the image optimizer
 * repoints rows to a new file and size). Only touches rows that still exist
 * locally and aren't deleted here, so it can't resurrect a local delete. The
 * photo cap is 100, so a full fetch is tiny.
 */
export async function pullClimbImageFileUpdates(userId: string): Promise<void> {
	// size_bytes isn't in the generated Supabase types yet
	const { data, error } = await untypedSupabase
		.from("climb_images")
		.select("id, image_url, size_bytes, deleted_at")
		.eq("user_id", userId);
	if (error) throw error;
	if (!data || data.length === 0) return;

	const db = await getDb();
	for (const row of data as {
		id: string;
		image_url: string;
		size_bytes: number | null;
		deleted_at: string | null;
	}[]) {
		if (row.deleted_at) continue;
		await db.execute(
			`UPDATE climb_images SET image_url = ?, size_bytes = ?
       WHERE id = ? AND deleted_at IS NULL AND (image_url != ? OR size_bytes IS NOT ?)`,
			[
				row.image_url,
				row.size_bytes ?? null,
				row.id,
				row.image_url,
				row.size_bytes ?? null,
			],
		);
	}
}

// ── Climb image pins push/pull ────────────────────────────────────────────────

export async function pushClimbImagePins(
	userId: string,
	since?: string,
): Promise<void> {
	const db = await getDb();
	// Join through climb_images to scope by user
	const pins = await db.select<ClimbImagePin[]>(
		since
			? `SELECT p.* FROM climb_image_pins p
         JOIN climb_images i ON i.id = p.climb_image_id
         WHERE i.user_id = ? AND p.created_at > ?`
			: `SELECT p.* FROM climb_image_pins p
         JOIN climb_images i ON i.id = p.climb_image_id
         WHERE i.user_id = ?`,
		since ? [userId, since] : [userId],
	);
	if (pins.length === 0) return;

	const { error } = await supabase.from("climb_image_pins").upsert(pins, {
		onConflict: "id",
	});
	if (error) throw error;
}

export async function pullClimbImagePins(
	_userId: string,
	since?: string,
): Promise<void> {
	// RLS on Supabase scopes this to the authenticated user's own image pins.
	let query = supabase.from("climb_image_pins").select("*");
	if (since) query = query.gt("created_at", since);

	const { data, error } = await query;
	if (error) throw error;
	if (!data || data.length === 0) return;

	for (const row of data) {
		await applyRemoteClimbImagePin(row as ClimbImagePin);
	}
}

// ── Route / wall images pull (one-way — admin-managed content) ────────────────
//
// Fully re-pulled on every sync (small admin tables) so edits to an existing
// row — e.g. the image optimizer repointing a file to a new WebP path — reach
// other devices. Rows deleted on the server are not pruned yet (see the
// "deleted gallery images" issue).

export async function pullRouteImages(): Promise<void> {
	const rows = await fetchAllRows<RouteImage>("route_images");
	for (const row of rows) await applyRemoteRouteImage(row);
}

export async function pullWallImages(): Promise<void> {
	const rows = await fetchAllRows<WallImage>("wall_images");
	for (const row of rows) await applyRemoteWallImage(row);
}

// ── Topos pull (one-way — admin-managed content) ──────────────────────────────
//
// Topo tables are small and admin-owned, so they are fully re-pulled on every
// sync (edits to an existing topo don't change created_at, so a delta pull would
// miss them) and cache rows deleted on the server are pruned afterwards.

// Topo tables are not yet in the generated Supabase types
// biome-ignore lint/suspicious/noExplicitAny: topo tables not in generated types
const untypedSupabase = supabase as any;
const TOPO_PAGE_SIZE = 1000;

async function fetchAllRows<T>(table: string): Promise<T[]> {
	const rows: T[] = [];
	for (let from = 0; ; from += TOPO_PAGE_SIZE) {
		const { data, error } = await untypedSupabase
			.from(table)
			.select("*")
			.order("id")
			.range(from, from + TOPO_PAGE_SIZE - 1);
		if (error) throw error;
		if (!data || data.length === 0) break;
		rows.push(...(data as T[]));
		if (data.length < TOPO_PAGE_SIZE) break;
	}
	return rows;
}

export async function pullWallTopos(): Promise<void> {
	const rows = await fetchAllRows<WallTopo>("wall_topos");
	for (const row of rows) await applyRemoteWallTopo(row);
	await pruneTopoCache(
		"wall_topos_cache",
		rows.map((r) => r.id),
	);
}

export async function pullWallTopoLines(): Promise<void> {
	const rows = await fetchAllRows<
		Omit<WallTopoLine, "points"> & { points: string }
	>("wall_topo_lines");
	for (const row of rows) await applyRemoteWallTopoLine(row);
	await pruneTopoCache(
		"wall_topo_lines_cache",
		rows.map((r) => r.id),
	);
}

export async function pullRouteTopos(): Promise<void> {
	const rows = await fetchAllRows<
		Omit<RouteTopo, "points"> & { points: string }
	>("route_topos");
	for (const row of rows) await applyRemoteRouteTopo(row);
	await pruneTopoCache(
		"route_topos_cache",
		rows.map((r) => r.id),
	);
}

// ── Route links push/pull (community data — all authenticated users) ──────────

export async function pushRouteLinks(
	userId: string,
	since?: string,
): Promise<void> {
	const db = await getDb();
	const links = await db.select<RouteLink[]>(
		since
			? "SELECT * FROM route_links WHERE user_id = ? AND created_at > ?"
			: "SELECT * FROM route_links WHERE user_id = ?",
		since ? [userId, since] : [userId],
	);
	if (links.length === 0) return;

	const { error } = await supabase.from("route_links").upsert(links, {
		onConflict: "id",
	});
	if (error) throw error;
}

export async function pullRouteLinks(since?: string): Promise<void> {
	let query = supabase.from("route_links").select("*");
	if (since) query = query.gt("created_at", since);

	const { data, error } = await query;
	if (error) throw error;
	if (!data || data.length === 0) return;

	for (const row of data) {
		await applyRemoteRouteLink(row as RouteLink);
	}
}
