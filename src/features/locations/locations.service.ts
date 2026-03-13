import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type {
	Country,
	Crag,
	CragSubmitValues,
	Region,
	SubRegion,
	SubRegionSubmitValues,
	Wall,
	WallSubmitValues,
} from "./locations.schema";

export async function fetchCountries(): Promise<Country[]> {
	const db = await getDb();
	return db.select<Country[]>(
		"SELECT * FROM countries_cache ORDER BY sort_order ASC",
	);
}

export async function fetchRegions(countryId: string): Promise<Region[]> {
	const db = await getDb();
	return db.select<Region[]>(
		"SELECT * FROM regions_cache WHERE country_id = ? ORDER BY sort_order ASC",
		[countryId],
	);
}

export async function fetchSubRegions(regionId: string): Promise<SubRegion[]> {
	const db = await getDb();
	return db.select<SubRegion[]>(
		"SELECT * FROM sub_regions_cache WHERE region_id = ? ORDER BY sort_order ASC",
		[regionId],
	);
}

export async function fetchCrags(subRegionId: string): Promise<Crag[]> {
	const db = await getDb();
	return db.select<Crag[]>(
		"SELECT * FROM crags_cache WHERE sub_region_id = ? ORDER BY sort_order ASC",
		[subRegionId],
	);
}

export async function fetchWalls(cragId: string): Promise<Wall[]> {
	const db = await getDb();
	return db.select<Wall[]>(
		"SELECT * FROM walls_cache WHERE crag_id = ? ORDER BY sort_order ASC",
		[cragId],
	);
}

// ── Single-entity fetches ────────────────────────────────────────────────────

export async function fetchSubRegion(id: string): Promise<SubRegion | null> {
	const db = await getDb();
	const rows = await db.select<SubRegion[]>(
		"SELECT * FROM sub_regions_cache WHERE id = ?",
		[id],
	);
	return rows[0] ?? null;
}

export async function fetchCrag(id: string): Promise<Crag | null> {
	const db = await getDb();
	const rows = await db.select<Crag[]>(
		"SELECT * FROM crags_cache WHERE id = ?",
		[id],
	);
	return rows[0] ?? null;
}

export async function fetchWall(id: string): Promise<Wall | null> {
	const db = await getDb();
	const rows = await db.select<Wall[]>(
		"SELECT * FROM walls_cache WHERE id = ?",
		[id],
	);
	return rows[0] ?? null;
}

// ── Admin description update ─────────────────────────────────────────────────

type LocationTable = "sub_regions" | "crags" | "walls";
type LocationCacheTable = "sub_regions_cache" | "crags_cache" | "walls_cache";

function cacheTableForUpdate(table: LocationTable): LocationCacheTable {
	return `${table}_cache` as LocationCacheTable;
}

export async function updateLocationDescription(
	table: LocationTable,
	id: string,
	description: string,
): Promise<void> {
	const { error } = await supabase
		.from(table)
		.update({ description })
		.eq("id", id);
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		`UPDATE ${cacheTableForUpdate(table)} SET description = ? WHERE id = ?`,
		[description, id],
	);
}

export async function fetchDownloadedRegionIds(): Promise<string[]> {
	const db = await getDb();
	const rows = await db.select<{ region_id: string }[]>(
		"SELECT region_id FROM downloaded_regions",
	);
	return rows.map((r) => r.region_id);
}

// ── Search (local cache only) ─────────────────────────────────────────────────

export type LocationSearchResult = {
	id: string;
	name: string;
	kind: "sub_region" | "crag" | "wall";
};

export async function searchLocations(
	query: string,
): Promise<LocationSearchResult[]> {
	const db = await getDb();
	const like = `%${query}%`;
	const [subRegions, crags, walls] = await Promise.all([
		db.select<{ id: string; name: string }[]>(
			"SELECT id, name FROM sub_regions_cache WHERE name LIKE ? ORDER BY name ASC LIMIT 20",
			[like],
		),
		db.select<{ id: string; name: string }[]>(
			"SELECT id, name FROM crags_cache WHERE name LIKE ? ORDER BY name ASC LIMIT 20",
			[like],
		),
		db.select<{ id: string; name: string }[]>(
			"SELECT id, name FROM walls_cache WHERE name LIKE ? ORDER BY name ASC LIMIT 20",
			[like],
		),
	]);
	return [
		...subRegions.map((r) => ({ ...r, kind: "sub_region" as const })),
		...crags.map((r) => ({ ...r, kind: "crag" as const })),
		...walls.map((r) => ({ ...r, kind: "wall" as const })),
	].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Sync pulls ────────────────────────────────────────────────────────────────

export async function pullCountries(): Promise<void> {
	const { data, error } = await supabase.from("countries").select("*");
	if (error) throw error;
	if (!data || data.length === 0) return;

	const db = await getDb();
	await db.execute("DELETE FROM countries_cache");
	for (const row of data as Country[]) {
		await db.execute(
			`INSERT INTO countries_cache (id, name, code, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?)`,
			[row.id, row.name, row.code, row.sort_order, row.created_at],
		);
	}
}

export async function pullRegions(): Promise<void> {
	const { data, error } = await supabase.from("regions").select("*");
	if (error) throw error;
	if (!data || data.length === 0) return;

	const db = await getDb();
	await db.execute("DELETE FROM regions_cache");
	for (const row of data as Region[]) {
		await db.execute(
			`INSERT INTO regions_cache (id, country_id, name, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?)`,
			[row.id, row.country_id, row.name, row.sort_order, row.created_at],
		);
	}
}

// ── Region download (full hierarchy pull) ─────────────────────────────────────

export async function downloadRegion(regionId: string): Promise<void> {
	const db = await getDb();

	// 1. Pull sub_regions
	const { data: subRegions, error: srError } = await supabase
		.from("sub_regions")
		.select("*")
		.eq("region_id", regionId);
	if (srError) throw srError;

	await db.execute("DELETE FROM sub_regions_cache WHERE region_id = ?", [
		regionId,
	]);

	if (!subRegions || subRegions.length === 0) {
		await db.execute(
			"INSERT OR REPLACE INTO downloaded_regions (region_id, downloaded_at) VALUES (?, datetime('now'))",
			[regionId],
		);
		return;
	}

	for (const row of subRegions as SubRegion[]) {
		await db.execute(
			"INSERT INTO sub_regions_cache (id, region_id, name, description, sort_order, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			[
				row.id,
				row.region_id,
				row.name,
				row.description ?? null,
				row.sort_order,
				row.status ?? "verified",
				row.created_by ?? null,
				row.created_at,
			],
		);
	}

	// 2. Pull crags
	const subRegionIds = subRegions.map((sr) => sr.id);
	const srPlaceholders = subRegionIds.map(() => "?").join(",");

	const { data: crags, error: cError } = await supabase
		.from("crags")
		.select("*")
		.in("sub_region_id", subRegionIds);
	if (cError) throw cError;

	await db.execute(
		`DELETE FROM crags_cache WHERE sub_region_id IN (${srPlaceholders})`,
		subRegionIds,
	);

	if (crags && crags.length > 0) {
		for (const row of crags as Crag[]) {
			await db.execute(
				"INSERT INTO crags_cache (id, sub_region_id, name, description, sort_order, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
				[
					row.id,
					row.sub_region_id,
					row.name,
					row.description ?? null,
					row.sort_order,
					row.status ?? "verified",
					row.created_by ?? null,
					row.created_at,
				],
			);
		}

		// 3. Pull walls
		const cragIds = crags.map((c) => c.id);
		const cPlaceholders = cragIds.map(() => "?").join(",");

		const { data: walls, error: wError } = await supabase
			.from("walls")
			.select("*")
			.in("crag_id", cragIds);
		if (wError) throw wError;

		await db.execute(
			`DELETE FROM walls_cache WHERE crag_id IN (${cPlaceholders})`,
			cragIds,
		);

		if (walls && walls.length > 0) {
			for (const row of walls as Wall[]) {
				await db.execute(
					"INSERT INTO walls_cache (id, crag_id, name, description, sort_order, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
					[
						row.id,
						row.crag_id,
						row.name,
						row.description ?? null,
						row.sort_order,
						row.status ?? "verified",
						row.created_by ?? null,
						row.created_at,
					],
				);
			}

			// 4. Pull verified routes
			const wallIds = walls.map((w) => w.id);
			const wPlaceholders = wallIds.map(() => "?").join(",");

			const { data: routes, error: rError } = await supabase
				.from("routes")
				.select("*")
				.in("wall_id", wallIds)
				.eq("status", "verified");
			if (rError) throw rError;

			await db.execute(
				`DELETE FROM routes_cache WHERE wall_id IN (${wPlaceholders})`,
				wallIds,
			);

			if (routes && routes.length > 0) {
				for (const row of routes) {
					await db.execute(
						"INSERT INTO routes_cache (id, wall_id, name, grade, route_type, description, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
						[
							row.id,
							row.wall_id,
							row.name,
							row.grade,
							row.route_type,
							row.description,
							"verified",
							row.created_by,
							row.created_at,
						],
					);
				}
			}
		}
	}

	await db.execute(
		"INSERT OR REPLACE INTO downloaded_regions (region_id, downloaded_at) VALUES (?, datetime('now'))",
		[regionId],
	);
}

// ── User submissions ──────────────────────────────────────────────────────────

export async function submitSubRegion(
	values: SubRegionSubmitValues,
	userId: string,
): Promise<void> {
	const id = crypto.randomUUID();
	const { error } = await supabase.from("sub_regions").insert({
		id,
		region_id: values.region_id,
		name: values.name,
		sort_order: 9999,
		status: "pending",
		created_by: userId,
	});
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		"INSERT INTO sub_regions_cache (id, region_id, name, sort_order, status, created_by, created_at) VALUES (?, ?, ?, 9999, 'pending', ?, datetime('now'))",
		[id, values.region_id, values.name, userId],
	);
}

export async function submitCrag(
	values: CragSubmitValues,
	userId: string,
): Promise<void> {
	const id = crypto.randomUUID();
	const { error } = await supabase.from("crags").insert({
		id,
		sub_region_id: values.sub_region_id,
		name: values.name,
		sort_order: 9999,
		status: "pending",
		created_by: userId,
	});
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		"INSERT INTO crags_cache (id, sub_region_id, name, sort_order, status, created_by, created_at) VALUES (?, ?, ?, 9999, 'pending', ?, datetime('now'))",
		[id, values.sub_region_id, values.name, userId],
	);
}

export async function submitWall(
	values: WallSubmitValues,
	userId: string,
): Promise<void> {
	const id = crypto.randomUUID();
	const { error } = await supabase.from("walls").insert({
		id,
		crag_id: values.crag_id,
		name: values.name,
		sort_order: 9999,
		status: "pending",
		created_by: userId,
	});
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		"INSERT INTO walls_cache (id, crag_id, name, sort_order, status, created_by, created_at) VALUES (?, ?, ?, 9999, 'pending', ?, datetime('now'))",
		[id, values.crag_id, values.name, userId],
	);
}

// ── Admin location verification ───────────────────────────────────────────────

export async function verifyLocation(
	table: LocationTable,
	id: string,
): Promise<void> {
	const { error } = await supabase
		.from(table)
		.update({ status: "verified" })
		.eq("id", id);
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		`UPDATE ${cacheTableForUpdate(table)} SET status = 'verified' WHERE id = ?`,
		[id],
	);
}

export async function rejectLocation(
	table: LocationTable,
	id: string,
): Promise<void> {
	const { error } = await supabase
		.from(table)
		.update({ status: "rejected", deleted_at: new Date().toISOString() })
		.eq("id", id);
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		`UPDATE ${cacheTableForUpdate(table)} SET status = 'rejected' WHERE id = ?`,
		[id],
	);
}

export type PendingLocationItem = {
	id: string;
	name: string;
	status: string;
	created_by: string | null;
	created_at: string;
	type: "sub_region" | "crag" | "wall";
	parent_name: string;
};

export async function fetchPendingLocations(): Promise<PendingLocationItem[]> {
	const [srRes, cRes, wRes] = await Promise.all([
		supabase
			.from("sub_regions")
			.select("id, name, status, created_by, created_at, regions(name)")
			.eq("status", "pending")
			.order("created_at", { ascending: false }),
		supabase
			.from("crags")
			.select("id, name, status, created_by, created_at, sub_regions(name)")
			.eq("status", "pending")
			.order("created_at", { ascending: false }),
		supabase
			.from("walls")
			.select("id, name, status, created_by, created_at, crags(name)")
			.eq("status", "pending")
			.order("created_at", { ascending: false }),
	]);

	if (srRes.error) throw srRes.error;
	if (cRes.error) throw cRes.error;
	if (wRes.error) throw wRes.error;

	const subRegions: PendingLocationItem[] = (srRes.data ?? []).map((r) => ({
		id: r.id,
		name: r.name,
		status: r.status,
		created_by: r.created_by,
		created_at: r.created_at,
		type: "sub_region" as const,
		parent_name:
			(r.regions as { name: string } | null)?.name ?? "Unknown region",
	}));

	const crags: PendingLocationItem[] = (cRes.data ?? []).map((r) => ({
		id: r.id,
		name: r.name,
		status: r.status,
		created_by: r.created_by,
		created_at: r.created_at,
		type: "crag" as const,
		parent_name:
			(r.sub_regions as { name: string } | null)?.name ?? "Unknown sub-region",
	}));

	const walls: PendingLocationItem[] = (wRes.data ?? []).map((r) => ({
		id: r.id,
		name: r.name,
		status: r.status,
		created_by: r.created_by,
		created_at: r.created_at,
		type: "wall" as const,
		parent_name: (r.crags as { name: string } | null)?.name ?? "Unknown crag",
	}));

	return [...subRegions, ...crags, ...walls].sort(
		(a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
	);
}

// ── Admin writes (go directly to Supabase) ───────────────────────────────────

export async function adminAddCountry(
	name: string,
	code: string,
	sortOrder: number,
): Promise<void> {
	const { error } = await supabase
		.from("countries")
		.insert({ id: crypto.randomUUID(), name, code, sort_order: sortOrder });
	if (error) throw error;
}

export async function adminDeleteCountry(id: string): Promise<void> {
	const { error } = await supabase.from("countries").delete().eq("id", id);
	if (error) throw error;
}

export async function adminAddRegion(
	countryId: string,
	name: string,
	sortOrder: number,
): Promise<void> {
	const { error } = await supabase.from("regions").insert({
		id: crypto.randomUUID(),
		country_id: countryId,
		name,
		sort_order: sortOrder,
	});
	if (error) throw error;
}

export async function adminDeleteRegion(id: string): Promise<void> {
	const { error } = await supabase.from("regions").delete().eq("id", id);
	if (error) throw error;
}
