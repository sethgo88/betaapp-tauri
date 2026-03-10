import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type {
	Country,
	Crag,
	Region,
	SubRegion,
	Wall,
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

export async function fetchDownloadedRegionIds(): Promise<string[]> {
	const db = await getDb();
	const rows = await db.select<{ region_id: string }[]>(
		"SELECT region_id FROM downloaded_regions",
	);
	return rows.map((r) => r.region_id);
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
			"INSERT INTO sub_regions_cache (id, region_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
			[row.id, row.region_id, row.name, row.sort_order, row.created_at],
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
				"INSERT INTO crags_cache (id, sub_region_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
				[row.id, row.sub_region_id, row.name, row.sort_order, row.created_at],
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
					"INSERT INTO walls_cache (id, crag_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
					[row.id, row.crag_id, row.name, row.sort_order, row.created_at],
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
