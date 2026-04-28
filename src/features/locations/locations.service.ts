import { getDb } from "@/lib/db";
import type { SunData } from "@/lib/sun";
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
		`SELECT c.*, (SELECT COUNT(*) FROM regions_cache r WHERE r.country_id = c.id) AS region_count
		 FROM countries_cache c ORDER BY c.sort_order ASC`,
	);
}

export async function fetchRegions(countryId: string): Promise<Region[]> {
	const db = await getDb();
	return db.select<Region[]>(
		`SELECT r.*, (SELECT COUNT(*) FROM sub_regions_cache sr WHERE sr.region_id = r.id) AS sub_region_count
		 FROM regions_cache r WHERE r.country_id = ? ORDER BY r.sort_order ASC`,
		[countryId],
	);
}

export async function fetchSubRegions(regionId: string): Promise<SubRegion[]> {
	const db = await getDb();
	return db.select<SubRegion[]>(
		`SELECT sr.*, (SELECT COUNT(*) FROM crags_cache c WHERE c.sub_region_id = sr.id) AS crag_count
		 FROM sub_regions_cache sr WHERE sr.region_id = ? ORDER BY sr.sort_order ASC`,
		[regionId],
	);
}

export async function fetchCrags(subRegionId: string): Promise<Crag[]> {
	const db = await getDb();
	return db.select<Crag[]>(
		`SELECT c.*, (SELECT COUNT(*) FROM walls_cache w WHERE w.crag_id = c.id) AS wall_count
		 FROM crags_cache c WHERE c.sub_region_id = ? ORDER BY c.sort_order ASC`,
		[subRegionId],
	);
}

function parseSunData<T extends { sun_data?: unknown }>(row: T): T {
	if (typeof row.sun_data !== "string" || !row.sun_data) return row;
	try {
		return { ...row, sun_data: JSON.parse(row.sun_data) };
	} catch {
		return { ...row, sun_data: null };
	}
}

export async function fetchWalls(cragId: string): Promise<Wall[]> {
	const db = await getDb();
	const rows = await db.select<Wall[]>(
		`SELECT w.*, (SELECT COUNT(*) FROM routes_cache r WHERE r.wall_id = w.id) AS route_count
		 FROM walls_cache w WHERE w.crag_id = ? ORDER BY w.sort_order ASC`,
		[cragId],
	);
	return rows.map(parseSunData);
}

// ── Single-entity fetches ────────────────────────────────────────────────────

export async function fetchRegion(id: string): Promise<Region | null> {
	const db = await getDb();
	const rows = await db.select<Region[]>(
		"SELECT * FROM regions_cache WHERE id = ?",
		[id],
	);
	return rows[0] ?? null;
}

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
	return rows[0] ? parseSunData(rows[0]) : null;
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

export async function updateLocationApproach(
	table: "crags" | "walls",
	id: string,
	approach: string,
): Promise<void> {
	// biome-ignore lint/suspicious/noExplicitAny: approach not yet in generated Supabase types
	const { error } = await (supabase.from(table) as any)
		.update({ approach })
		.eq("id", id);
	if (error) throw error;

	const cacheTable = table === "crags" ? "crags_cache" : "walls_cache";
	const db = await getDb();
	await db.execute(`UPDATE ${cacheTable} SET approach = ? WHERE id = ?`, [
		approach,
		id,
	]);
}

export async function fetchDownloadedRegionIds(): Promise<string[]> {
	const db = await getDb();
	const rows = await db.select<{ region_id: string }[]>(
		"SELECT region_id FROM downloaded_regions",
	);
	return rows.map((r) => r.region_id);
}

export type DownloadedRegion = {
	region_id: string;
	downloaded_at: string;
	server_updated_at: string | null;
};

export async function fetchDownloadedRegions(): Promise<DownloadedRegion[]> {
	const db = await getDb();
	return db.select<DownloadedRegion[]>(
		"SELECT region_id, downloaded_at, server_updated_at FROM downloaded_regions",
	);
}

export async function checkRegionStaleness(): Promise<string[]> {
	const downloaded = await fetchDownloadedRegions();
	if (downloaded.length === 0) return [];

	const ids = downloaded.map((r) => r.region_id);
	const { data, error } = await supabase
		.from("regions")
		.select("id, created_at")
		.in("id", ids);
	if (error) throw error;

	const serverMap = new Map<string, string>(
		(data as unknown as { id: string; created_at: string }[]).map((r) => [
			r.id,
			r.created_at,
		]),
	);

	return downloaded
		.filter((local) => {
			const serverUpdatedAt = serverMap.get(local.region_id);
			if (!serverUpdatedAt || !local.server_updated_at) return false;
			return new Date(serverUpdatedAt) > new Date(local.server_updated_at);
		})
		.map((r) => r.region_id);
}

// ── Search (local cache only) ─────────────────────────────────────────────────

export type LocationSearchResult = {
	id: string;
	name: string;
	kind: "sub_region" | "crag" | "wall";
	parent_name: string;
};

export async function searchLocations(
	query: string,
	stopAt: "sub_region" | "crag" | "wall" = "wall",
): Promise<LocationSearchResult[]> {
	const db = await getDb();
	const like = `%${query}%`;

	type Row = { id: string; name: string; parent_name: string };

	const promises: Promise<LocationSearchResult[]>[] = [
		db
			.select<Row[]>(
				`SELECT sr.id, sr.name, r.name AS parent_name
				 FROM sub_regions_cache sr
				 JOIN regions_cache r ON r.id = sr.region_id
				 WHERE sr.name LIKE ? ORDER BY sr.name ASC LIMIT 20`,
				[like],
			)
			.then((rows) => rows.map((r) => ({ ...r, kind: "sub_region" as const }))),
	];

	if (stopAt === "crag" || stopAt === "wall") {
		promises.push(
			db
				.select<Row[]>(
					`SELECT c.id, c.name, sr.name AS parent_name
					 FROM crags_cache c
					 JOIN sub_regions_cache sr ON sr.id = c.sub_region_id
					 WHERE c.name LIKE ? ORDER BY c.name ASC LIMIT 20`,
					[like],
				)
				.then((rows) => rows.map((r) => ({ ...r, kind: "crag" as const }))),
		);
	}

	if (stopAt === "wall") {
		promises.push(
			db
				.select<Row[]>(
					`SELECT w.id, w.name, c.name AS parent_name
					 FROM walls_cache w
					 JOIN crags_cache c ON c.id = w.crag_id
					 WHERE w.name LIKE ? ORDER BY w.name ASC LIMIT 20`,
					[like],
				)
				.then((rows) => rows.map((r) => ({ ...r, kind: "wall" as const }))),
		);
	}

	const results = await Promise.all(promises);
	return results.flat().sort((a, b) => a.name.localeCompare(b.name));
}

export type LocationAncestors = {
	countryId: string;
	regionId: string;
	subRegionId?: string;
	cragId?: string;
	wallId?: string;
};

export async function getLocationAncestors(
	id: string,
	kind: "sub_region" | "crag" | "wall",
): Promise<LocationAncestors> {
	const db = await getDb();

	if (kind === "sub_region") {
		const rows = await db.select<{ region_id: string; country_id: string }[]>(
			`SELECT sr.region_id, r.country_id
			 FROM sub_regions_cache sr
			 JOIN regions_cache r ON r.id = sr.region_id
			 WHERE sr.id = ?`,
			[id],
		);
		if (!rows[0]) throw new Error(`Sub-region ${id} not found`);
		return {
			countryId: rows[0].country_id,
			regionId: rows[0].region_id,
			subRegionId: id,
		};
	}

	if (kind === "crag") {
		const rows = await db.select<
			{ sub_region_id: string; region_id: string; country_id: string }[]
		>(
			`SELECT c.sub_region_id, sr.region_id, r.country_id
			 FROM crags_cache c
			 JOIN sub_regions_cache sr ON sr.id = c.sub_region_id
			 JOIN regions_cache r ON r.id = sr.region_id
			 WHERE c.id = ?`,
			[id],
		);
		if (!rows[0]) throw new Error(`Crag ${id} not found`);
		return {
			countryId: rows[0].country_id,
			regionId: rows[0].region_id,
			subRegionId: rows[0].sub_region_id,
			cragId: id,
		};
	}

	// kind === "wall"
	const rows = await db.select<
		{
			crag_id: string;
			sub_region_id: string;
			region_id: string;
			country_id: string;
		}[]
	>(
		`SELECT w.crag_id, c.sub_region_id, sr.region_id, r.country_id
		 FROM walls_cache w
		 JOIN crags_cache c ON c.id = w.crag_id
		 JOIN sub_regions_cache sr ON sr.id = c.sub_region_id
		 JOIN regions_cache r ON r.id = sr.region_id
		 WHERE w.id = ?`,
		[id],
	);
	if (!rows[0]) throw new Error(`Wall ${id} not found`);
	return {
		countryId: rows[0].country_id,
		regionId: rows[0].region_id,
		subRegionId: rows[0].sub_region_id,
		cragId: rows[0].crag_id,
		wallId: id,
	};
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
	for (const row of data as unknown as Region[]) {
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

	// 0. Fetch region metadata (including server updated_at for staleness tracking)
	const { data: regionMeta, error: regionMetaError } = await supabase
		.from("regions")
		.select("created_at")
		.eq("id", regionId)
		.single();
	if (regionMetaError) throw regionMetaError;
	const serverUpdatedAt: string | null =
		(regionMeta as unknown as { created_at?: string } | null)?.created_at ??
		null;

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
			"INSERT OR REPLACE INTO downloaded_regions (region_id, downloaded_at, server_updated_at) VALUES (?, datetime('now'), ?)",
			[regionId, serverUpdatedAt],
		);
		return;
	}

	for (const row of subRegions as unknown as SubRegion[]) {
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
		for (const row of crags as unknown as Crag[]) {
			await db.execute(
				"INSERT INTO crags_cache (id, sub_region_id, name, description, approach, sort_order, status, created_by, created_at, lat, lng, sport_count, trad_count, boulder_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				[
					row.id,
					row.sub_region_id,
					row.name,
					row.description ?? null,
					row.approach ?? null,
					row.sort_order,
					row.status ?? "verified",
					row.created_by ?? null,
					row.created_at,
					row.lat ?? null,
					row.lng ?? null,
					row.sport_count ?? 0,
					row.trad_count ?? 0,
					row.boulder_count ?? 0,
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
			for (const row of walls as unknown as Wall[]) {
				await db.execute(
					"INSERT INTO walls_cache (id, crag_id, name, description, approach, sort_order, status, created_by, created_at, lat, lng, wall_type, sport_count, trad_count, boulder_count, sun_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
					[
						row.id,
						row.crag_id,
						row.name,
						row.description ?? null,
						row.approach ?? null,
						row.sort_order,
						row.status ?? "verified",
						row.created_by ?? null,
						row.created_at,
						row.lat ?? null,
						row.lng ?? null,
						row.wall_type ?? "wall",
						row.sport_count ?? 0,
						row.trad_count ?? 0,
						row.boulder_count ?? 0,
						row.sun_data != null ? JSON.stringify(row.sun_data) : null,
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
				`DELETE FROM route_tags_cache WHERE route_id IN (SELECT id FROM routes_cache WHERE wall_id IN (${wPlaceholders}))`,
				wallIds,
			);
			await db.execute(
				`DELETE FROM wall_tags_cache WHERE wall_id IN (${wPlaceholders})`,
				wallIds,
			);
			await db.execute(
				`DELETE FROM routes_cache WHERE wall_id IN (${wPlaceholders})`,
				wallIds,
			);

			if (routes && routes.length > 0) {
				for (const row of routes) {
					await db.execute(
						"INSERT INTO routes_cache (id, wall_id, name, grade, route_type, description, status, created_by, created_at, sun_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
							row.sun_data != null ? JSON.stringify(row.sun_data) : null,
						],
					);
				}
			}

			// 5. Pull route tags
			const routeIds = (routes ?? []).map((r) => r.id);
			if (routeIds.length > 0) {
				const rTagPlaceholders = routeIds.map(() => "?").join(",");
				const { data: routeTags, error: rtError } = await supabase
					.from("route_tags")
					.select("*")
					.in("route_id", routeIds);
				if (rtError) throw rtError;
				await db.execute(
					`DELETE FROM route_tags_cache WHERE route_id IN (${rTagPlaceholders})`,
					routeIds,
				);
				for (const rt of routeTags ?? []) {
					await db.execute(
						"INSERT INTO route_tags_cache (id, route_id, tag_id) VALUES (?, ?, ?)",
						[rt.id, rt.route_id, rt.tag_id],
					);
				}
			}

			// 6. Pull wall tags
			if (wallIds.length > 0) {
				const { data: wallTags, error: wtError } = await supabase
					.from("wall_tags")
					.select("*")
					.in("wall_id", wallIds);
				if (wtError) throw wtError;
				await db.execute(
					`DELETE FROM wall_tags_cache WHERE wall_id IN (${wPlaceholders})`,
					wallIds,
				);
				for (const wt of wallTags ?? []) {
					await db.execute(
						"INSERT INTO wall_tags_cache (id, wall_id, tag_id) VALUES (?, ?, ?)",
						[wt.id, wt.wall_id, wt.tag_id],
					);
				}
			}
		}
	}

	await db.execute(
		"INSERT OR REPLACE INTO downloaded_regions (region_id, downloaded_at, server_updated_at) VALUES (?, datetime('now'), ?)",
		[regionId, serverUpdatedAt],
	);
}

// ── User submissions ──────────────────────────────────────────────────────────

export async function submitSubRegion(
	values: SubRegionSubmitValues,
	userId: string,
	isAdmin = false,
): Promise<void> {
	const id = crypto.randomUUID();
	const status = isAdmin ? "verified" : "pending";
	const { error } = await supabase.from("sub_regions").insert({
		id,
		region_id: values.region_id,
		name: values.name,
		sort_order: 9999,
		status,
		created_by: userId,
	});
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		"INSERT INTO sub_regions_cache (id, region_id, name, sort_order, status, created_by, created_at) VALUES (?, ?, ?, 9999, ?, ?, datetime('now'))",
		[id, values.region_id, values.name, status, userId],
	);
}

export async function submitCrag(
	values: CragSubmitValues,
	userId: string,
	isAdmin = false,
): Promise<void> {
	const id = crypto.randomUUID();
	const status = isAdmin ? "verified" : "pending";
	const { error } = await supabase.from("crags").insert({
		id,
		sub_region_id: values.sub_region_id,
		name: values.name,
		sort_order: 9999,
		status,
		created_by: userId,
		lat: values.lat ?? null,
		lng: values.lng ?? null,
	});
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		"INSERT INTO crags_cache (id, sub_region_id, name, sort_order, status, created_by, created_at, lat, lng) VALUES (?, ?, ?, 9999, ?, ?, datetime('now'), ?, ?)",
		[
			id,
			values.sub_region_id,
			values.name,
			status,
			userId,
			values.lat ?? null,
			values.lng ?? null,
		],
	);
}

export async function submitWall(
	values: WallSubmitValues,
	userId: string,
	isAdmin = false,
): Promise<void> {
	const id = crypto.randomUUID();
	const status = isAdmin ? "verified" : "pending";
	// biome-ignore lint/suspicious/noExplicitAny: wall_type not yet in generated Supabase types
	const { error } = await (supabase.from("walls") as any).insert({
		id,
		crag_id: values.crag_id,
		name: values.name,
		wall_type: values.wall_type ?? "wall",
		lat: values.lat ?? null,
		lng: values.lng ?? null,
		sort_order: 9999,
		status,
		created_by: userId,
	});
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		"INSERT INTO walls_cache (id, crag_id, name, sort_order, status, created_by, created_at, lat, lng, wall_type) VALUES (?, ?, ?, 9999, ?, ?, datetime('now'), ?, ?, ?)",
		[
			id,
			values.crag_id,
			values.name,
			status,
			userId,
			values.lat ?? null,
			values.lng ?? null,
			values.wall_type ?? "wall",
		],
	);

	// Inherit wall coords to crag if crag has no coordinates
	if (values.lat != null && values.lng != null) {
		await inheritWallCoordsToCrag(values.crag_id, values.lat, values.lng);
	}
}

// ── Admin location add (creates verified directly) ────────────────────────────

export async function adminAddSubRegion(
	values: SubRegionSubmitValues,
	userId: string,
): Promise<{ id: string }> {
	const id = crypto.randomUUID();
	const { error } = await supabase.from("sub_regions").insert({
		id,
		region_id: values.region_id,
		name: values.name,
		sort_order: 9999,
		status: "verified",
		created_by: userId,
	});
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		"INSERT INTO sub_regions_cache (id, region_id, name, sort_order, status, created_by, created_at) VALUES (?, ?, ?, 9999, 'verified', ?, datetime('now'))",
		[id, values.region_id, values.name, userId],
	);
	return { id };
}

export async function adminAddCrag(
	values: CragSubmitValues,
	userId: string,
): Promise<{ id: string }> {
	const id = crypto.randomUUID();
	const { error } = await supabase.from("crags").insert({
		id,
		sub_region_id: values.sub_region_id,
		name: values.name,
		sort_order: 9999,
		status: "verified",
		created_by: userId,
		lat: values.lat ?? null,
		lng: values.lng ?? null,
	});
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		"INSERT INTO crags_cache (id, sub_region_id, name, sort_order, status, created_by, created_at, lat, lng) VALUES (?, ?, ?, 9999, 'verified', ?, datetime('now'), ?, ?)",
		[
			id,
			values.sub_region_id,
			values.name,
			userId,
			values.lat ?? null,
			values.lng ?? null,
		],
	);
	return { id };
}

export async function adminAddWall(
	values: WallSubmitValues,
	userId: string,
): Promise<{ id: string }> {
	const id = crypto.randomUUID();
	// biome-ignore lint/suspicious/noExplicitAny: wall_type not yet in generated Supabase types
	const { error } = await (supabase.from("walls") as any).insert({
		id,
		crag_id: values.crag_id,
		name: values.name,
		wall_type: values.wall_type ?? "wall",
		lat: values.lat ?? null,
		lng: values.lng ?? null,
		sort_order: 9999,
		status: "verified",
		created_by: userId,
	});
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		"INSERT INTO walls_cache (id, crag_id, name, sort_order, status, created_by, created_at, lat, lng, wall_type) VALUES (?, ?, ?, 9999, 'verified', ?, datetime('now'), ?, ?, ?)",
		[
			id,
			values.crag_id,
			values.name,
			userId,
			values.lat ?? null,
			values.lng ?? null,
			values.wall_type ?? "wall",
		],
	);

	if (values.lat != null && values.lng != null) {
		await inheritWallCoordsToCrag(values.crag_id, values.lat, values.lng);
	}
	return { id };
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
	code = "",
	sortOrder = 9999,
): Promise<{ id: string }> {
	const id = crypto.randomUUID();
	const { error } = await supabase
		.from("countries")
		.insert({ id, name, code, sort_order: sortOrder });
	if (error) throw error;
	const db = await getDb();
	await db.execute(
		"INSERT INTO countries_cache (id, name, code, sort_order, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
		[id, name, code, sortOrder],
	);
	return { id };
}

export async function adminDeleteCountry(id: string): Promise<void> {
	const { error } = await supabase.from("countries").delete().eq("id", id);
	if (error) throw error;
}

export async function adminAddRegion(
	countryId: string,
	name: string,
	sortOrder = 9999,
): Promise<{ id: string }> {
	const id = crypto.randomUUID();
	const { error } = await supabase.from("regions").insert({
		id,
		country_id: countryId,
		name,
		sort_order: sortOrder,
	});
	if (error) throw error;
	const db = await getDb();
	await db.execute(
		"INSERT INTO regions_cache (id, country_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
		[id, countryId, name, sortOrder],
	);
	return { id };
}

export async function adminDeleteRegion(id: string): Promise<void> {
	const { error } = await supabase.from("regions").delete().eq("id", id);
	if (error) throw error;
}

// ── Map: all crags with coordinates ─────────────────────────────────────────

export type MapCrag = {
	id: string;
	name: string;
	lat: number;
	lng: number;
	approach: string | null;
	sport_count: number;
	trad_count: number;
	boulder_count: number;
	has_sport: boolean;
	has_trad: boolean;
	has_boulder: boolean;
};

export async function fetchAllCragsWithCoords(): Promise<MapCrag[]> {
	const db = await getDb();
	const rows = await db.select<
		{
			id: string;
			name: string;
			lat: number;
			lng: number;
			approach: string | null;
			sport_count: number;
			trad_count: number;
			boulder_count: number;
		}[]
	>(
		`SELECT id, name, lat, lng, approach, sport_count, trad_count, boulder_count
		FROM crags_cache
		WHERE lat IS NOT NULL AND lng IS NOT NULL`,
	);
	return rows.map((r) => ({
		...r,
		has_sport: r.sport_count > 0,
		has_trad: r.trad_count > 0,
		has_boulder: r.boulder_count > 0,
	}));
}

// ── Map: admin coordinate editing ───────────────────────────────────────────

export async function adminUpdateCragCoords(
	id: string,
	lat: number | null,
	lng: number | null,
): Promise<void> {
	const { error } = await supabase
		.from("crags")
		.update({ lat, lng })
		.eq("id", id);
	if (error) throw error;

	const db = await getDb();
	await db.execute("UPDATE crags_cache SET lat = ?, lng = ? WHERE id = ?", [
		lat,
		lng,
		id,
	]);
}

// ── Map: admin wall coordinate editing ──────────────────────────────────────

export async function adminUpdateWallCoords(
	id: string,
	lat: number,
	lng: number,
	cragId: string,
): Promise<void> {
	// Update local cache first (always works)
	const db = await getDb();
	await db.execute("UPDATE walls_cache SET lat = ?, lng = ? WHERE id = ?", [
		lat,
		lng,
		id,
	]);

	// Sync to Supabase
	const { error } = await supabase
		.from("walls")
		.update({ lat, lng })
		.eq("id", id);
	if (error) {
		console.warn("Failed to sync wall coords to Supabase:", error.message);
	}

	// Inherit to crag if crag has no coordinates
	await inheritWallCoordsToCrag(cragId, lat, lng);
}

async function inheritWallCoordsToCrag(
	cragId: string,
	lat: number,
	lng: number,
): Promise<void> {
	const db = await getDb();
	const rows = await db.select<{ lat: number | null }[]>(
		"SELECT lat FROM crags_cache WHERE id = ?",
		[cragId],
	);
	if (rows.length > 0 && rows[0].lat == null) {
		await db.execute("UPDATE crags_cache SET lat = ?, lng = ? WHERE id = ?", [
			lat,
			lng,
			cragId,
		]);
		await supabase.from("crags").update({ lat, lng }).eq("id", cragId);
	}
}

// ── Map: all walls with coordinates ─────────────────────────────────────────

export type MapWall = {
	id: string;
	crag_id: string;
	name: string;
	crag_name: string;
	lat: number;
	lng: number;
	approach: string | null;
	wall_type: string;
	sport_count: number;
	trad_count: number;
	boulder_count: number;
	has_sport: boolean;
	has_trad: boolean;
	has_boulder: boolean;
};

export async function fetchAllWallsWithCoords(): Promise<MapWall[]> {
	const db = await getDb();
	const rows = await db.select<
		{
			id: string;
			crag_id: string;
			name: string;
			crag_name: string;
			lat: number;
			lng: number;
			approach: string | null;
			wall_type: string;
			sport_count: number;
			trad_count: number;
			boulder_count: number;
		}[]
	>(
		`SELECT w.id, w.crag_id, w.name, c.name AS crag_name, w.lat, w.lng,
			w.approach, w.wall_type, w.sport_count, w.trad_count, w.boulder_count
		FROM walls_cache w
		JOIN crags_cache c ON c.id = w.crag_id
		WHERE w.lat IS NOT NULL AND w.lng IS NOT NULL`,
	);
	return rows.map((r) => ({
		...r,
		has_sport: r.sport_count > 0,
		has_trad: r.trad_count > 0,
		has_boulder: r.boulder_count > 0,
	}));
}

// ── Admin: rename locations ───────────────────────────────────────────────────

export async function adminRenameLocation(
	table: LocationTable,
	id: string,
	name: string,
): Promise<void> {
	const { error } = await supabase.from(table).update({ name }).eq("id", id);
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		`UPDATE ${cacheTableForUpdate(table)} SET name = ? WHERE id = ?`,
		[name, id],
	);
}

// ── Admin: delete locations (blocked if children exist) ───────────────────────

export async function adminDeleteSubRegion(id: string): Promise<void> {
	const db = await getDb();
	const [children] = await db.select<{ count: number }[]>(
		"SELECT COUNT(*) as count FROM crags_cache WHERE sub_region_id = ?",
		[id],
	);
	if (children.count > 0) {
		throw new Error(
			`Cannot delete: has ${children.count} crag(s). Move them first.`,
		);
	}
	const { error } = await supabase
		.from("sub_regions")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", id);
	if (error) throw error;
	await db.execute("DELETE FROM sub_regions_cache WHERE id = ?", [id]);
}

export async function adminDeleteCrag(id: string): Promise<void> {
	const db = await getDb();
	const [children] = await db.select<{ count: number }[]>(
		"SELECT COUNT(*) as count FROM walls_cache WHERE crag_id = ?",
		[id],
	);
	if (children.count > 0) {
		throw new Error(
			`Cannot delete: has ${children.count} wall(s). Move them first.`,
		);
	}
	const { error } = await supabase
		.from("crags")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", id);
	if (error) throw error;
	await db.execute("DELETE FROM crags_cache WHERE id = ?", [id]);
}

export async function adminDeleteWall(id: string): Promise<void> {
	const db = await getDb();
	const [children] = await db.select<{ count: number }[]>(
		"SELECT COUNT(*) as count FROM routes_cache WHERE wall_id = ?",
		[id],
	);
	if (children.count > 0) {
		throw new Error(
			`Cannot delete: has ${children.count} route(s). Move them first.`,
		);
	}
	// biome-ignore lint/suspicious/noExplicitAny: deleted_at not yet in generated Supabase types
	const { error } = await (supabase.from("walls") as any)
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", id);
	if (error) throw error;
	await db.execute("DELETE FROM walls_cache WHERE id = ?", [id]);
}

// ── Admin: move crag/wall to a new parent ────────────────────────────────────

export async function adminMoveCrag(
	cragId: string,
	newSubRegionId: string,
): Promise<void> {
	const { error } = await supabase
		.from("crags")
		.update({ sub_region_id: newSubRegionId })
		.eq("id", cragId);
	if (error) throw error;

	const db = await getDb();
	await db.execute("UPDATE crags_cache SET sub_region_id = ? WHERE id = ?", [
		newSubRegionId,
		cragId,
	]);
}

export async function adminMoveWall(
	wallId: string,
	newCragId: string,
): Promise<void> {
	// biome-ignore lint/suspicious/noExplicitAny: crag_id not yet in generated Supabase types
	const { error } = await (supabase.from("walls") as any)
		.update({ crag_id: newCragId })
		.eq("id", wallId);
	if (error) throw error;

	const db = await getDb();
	await db.execute("UPDATE walls_cache SET crag_id = ? WHERE id = ?", [
		newCragId,
		wallId,
	]);
}

// ── Admin: update wall type ──────────────────────────────────────────────────

export async function adminUpdateWallType(
	id: string,
	wallType: string,
): Promise<void> {
	// biome-ignore lint/suspicious/noExplicitAny: wall_type not yet in generated Supabase types
	const { error } = await (supabase.from("walls") as any)
		.update({ wall_type: wallType })
		.eq("id", id);
	if (error) throw error;

	const db = await getDb();
	await db.execute("UPDATE walls_cache SET wall_type = ? WHERE id = ?", [
		wallType,
		id,
	]);
}

// ── Sun data ─────────────────────────────────────────────────────────────────

export async function updateWallSunData(
	wallId: string,
	data: SunData,
): Promise<void> {
	const serialized = JSON.stringify(data);
	// biome-ignore lint/suspicious/noExplicitAny: sun_data not yet in generated Supabase types
	const { error } = await (supabase.from("walls") as any)
		.update({ sun_data: data })
		.eq("id", wallId);
	if (error) throw error;

	const db = await getDb();
	await db.execute("UPDATE walls_cache SET sun_data = ? WHERE id = ?", [
		serialized,
		wallId,
	]);
}
