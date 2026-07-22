import { isTauri } from "@tauri-apps/api/core";
import { refreshRouteAvgRating } from "@/features/routes/routes.service";
import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Climb, ClimbFormValues, ClimbLink } from "./climbs.schema";
import type { SortKey } from "./climbs.store";

type LocationBreadcrumb = {
	country: string | null;
	area: string | null;
	sub_area: string | null;
	crag: string | null;
	wall: string | null;
};

async function fetchLocationForRoute(
	routeId: string,
): Promise<LocationBreadcrumb> {
	if (!isTauri()) {
		// Sequential Supabase lookups traversing the location hierarchy
		const { data: route } = await supabase
			.from("routes")
			.select("wall_id")
			.eq("id", routeId)
			.single();
		if (!route)
			return {
				country: null,
				area: null,
				sub_area: null,
				crag: null,
				wall: null,
			};
		const { data: wall } = await supabase
			.from("walls")
			.select("name, crag_id")
			.eq("id", route.wall_id)
			.single();
		if (!wall)
			return {
				country: null,
				area: null,
				sub_area: null,
				crag: null,
				wall: null,
			};
		const { data: crag } = await supabase
			.from("crags")
			.select("name, sub_region_id")
			.eq("id", wall.crag_id)
			.single();
		if (!crag)
			return {
				country: null,
				area: null,
				sub_area: null,
				crag: wall.name,
				wall: null,
			};
		const { data: subRegion } = await supabase
			.from("sub_regions")
			.select("name, region_id")
			.eq("id", crag.sub_region_id)
			.single();
		if (!subRegion)
			return {
				country: null,
				area: null,
				sub_area: crag.name,
				crag: null,
				wall: wall.name,
			};
		const { data: region } = await supabase
			.from("regions")
			.select("name, country_id")
			.eq("id", subRegion.region_id)
			.single();
		if (!region)
			return {
				country: null,
				area: subRegion.name,
				sub_area: crag.name,
				crag: null,
				wall: wall.name,
			};
		const { data: country } = await supabase
			.from("countries")
			.select("name")
			.eq("id", region.country_id)
			.single();
		return {
			country: country?.name ?? null,
			area: region.name,
			sub_area: subRegion.name,
			crag: crag.name,
			wall: wall.name,
		};
	}

	const db = await getDb();
	const rows = await db.select<LocationBreadcrumb[]>(
		`SELECT
      co.name as country,
      r.name as area,
      sr.name as sub_area,
      c.name as crag,
      w.name as wall
    FROM routes_cache rc
    JOIN walls_cache w ON w.id = rc.wall_id
    JOIN crags_cache c ON c.id = w.crag_id
    JOIN sub_regions_cache sr ON sr.id = c.sub_region_id
    JOIN regions_cache r ON r.id = sr.region_id
    JOIN countries_cache co ON co.id = r.country_id
    WHERE rc.id = ?`,
		[routeId],
	);
	return (
		rows[0] ?? {
			country: null,
			area: null,
			sub_area: null,
			crag: null,
			wall: null,
		}
	);
}

function buildOrderBy(sortKey: SortKey): string {
	switch (sortKey) {
		case "name_asc":
			return "ORDER BY c.name COLLATE NOCASE ASC";
		case "name_desc":
			return "ORDER BY c.name COLLATE NOCASE DESC";
		case "date_desc":
			return "ORDER BY c.created_at DESC";
		case "date_asc":
			return "ORDER BY c.created_at ASC";
		case "grade_asc":
			return "ORDER BY c.route_type ASC, COALESCE(g.sort_order, 9999) ASC";
		case "grade_desc":
			return "ORDER BY c.route_type ASC, COALESCE(g.sort_order, 9999) DESC";
	}
}

export async function fetchClimbs(
	userId: string,
	sortKey: SortKey = "name_asc",
): Promise<Climb[]> {
	if (!isTauri()) {
		const { data, error } = await supabase
			.from("climbs")
			.select("*")
			.eq("user_id", userId)
			.is("deleted_at", null);
		if (error) throw error;
		const climbs = (data as Climb[]) ?? [];
		// Apply grade sort in JS — requires grades table lookup, sort by name otherwise
		if (sortKey === "grade_asc" || sortKey === "grade_desc") {
			return climbs.sort((a, b) =>
				sortKey === "grade_asc"
					? a.grade.localeCompare(b.grade)
					: b.grade.localeCompare(a.grade),
			);
		}
		if (sortKey === "name_asc")
			return climbs.sort((a, b) =>
				a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
			);
		if (sortKey === "name_desc")
			return climbs.sort((a, b) =>
				b.name.localeCompare(a.name, undefined, { sensitivity: "base" }),
			);
		if (sortKey === "date_asc")
			return climbs.sort((a, b) => a.created_at.localeCompare(b.created_at));
		// date_desc
		return climbs.sort((a, b) => b.created_at.localeCompare(a.created_at));
	}

	const db = await getDb();
	const orderBy = buildOrderBy(sortKey);
	const needsGradeJoin = sortKey === "grade_asc" || sortKey === "grade_desc";
	if (needsGradeJoin) {
		return db.select<Climb[]>(
			`SELECT c.* FROM climbs c
       LEFT JOIN grades_cache g ON g.discipline = c.route_type AND g.grade = c.grade
       WHERE c.user_id = ? AND c.deleted_at IS NULL
       ${orderBy}`,
			[userId],
		);
	}
	return db.select<Climb[]>(
		`SELECT c.* FROM climbs c WHERE c.user_id = ? AND c.deleted_at IS NULL ${orderBy}`,
		[userId],
	);
}

export async function fetchClimb(id: string): Promise<Climb | null> {
	if (!isTauri()) {
		const { data, error } = await supabase
			.from("climbs")
			.select("*")
			.eq("id", id)
			.is("deleted_at", null)
			.single();
		if (error && error.code !== "PGRST116") throw error;
		return (data as Climb) ?? null;
	}
	const db = await getDb();
	const rows = await db.select<Climb[]>(
		"SELECT * FROM climbs WHERE id = ? AND deleted_at IS NULL",
		[id],
	);
	return rows[0] ?? null;
}

export async function backfillClimbLocations(): Promise<void> {
	if (!isTauri()) return;
	const db = await getDb();
	const rows = await db.select<{ id: string; route_id: string }[]>(
		"SELECT id, route_id FROM climbs WHERE route_id IS NOT NULL AND (country IS NULL OR country = '') AND deleted_at IS NULL",
	);
	for (const row of rows) {
		const loc = await fetchLocationForRoute(row.route_id);
		if (!loc.country && !loc.crag) continue;
		await db.execute(
			"UPDATE climbs SET country = ?, area = ?, sub_area = ?, crag = ?, wall = ? WHERE id = ?",
			[loc.country, loc.area, loc.sub_area, loc.crag, loc.wall, row.id],
		);
	}
}

export async function insertClimb(
	userId: string,
	data: ClimbFormValues,
	routeId?: string,
): Promise<string> {
	const id = crypto.randomUUID();

	let country = data.country ?? null;
	let area = data.area ?? null;
	let sub_area = data.sub_area ?? null;
	let crag = data.crag ?? null;
	let wall = data.wall ?? null;

	if (routeId) {
		const loc = await fetchLocationForRoute(routeId);
		if (loc.country) country = loc.country;
		if (loc.area) area = loc.area;
		if (loc.sub_area) sub_area = loc.sub_area;
		if (loc.crag) crag = loc.crag;
		if (loc.wall) wall = loc.wall;
	}

	if (!isTauri()) {
		const { error } = await supabase.from("climbs").insert({
			id,
			user_id: userId,
			name: data.name,
			route_type: data.route_type,
			grade: data.grade,
			moves: data.moves,
			sent_status: data.sent_status,
			country,
			area,
			sub_area,
			crag,
			wall,
			route_location: data.route_location ?? null,
			link: data.link ?? null,
			route_id: routeId ?? null,
			sent_date: data.sent_date ?? null,
			rating: data.rating ?? null,
		});
		if (error) throw error;
		return id;
	}

	const db = await getDb();
	await db.execute(
		`INSERT INTO climbs (id, user_id, name, route_type, grade, moves, sent_status, country, area, sub_area, crag, wall, route_location, link, route_id, sent_date, rating)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			userId,
			data.name,
			data.route_type,
			data.grade,
			data.moves,
			data.sent_status,
			country,
			area,
			sub_area,
			crag,
			wall,
			data.route_location ?? null,
			data.link ?? null,
			routeId ?? null,
			data.sent_date ?? null,
			data.rating ?? null,
		],
	);
	if (routeId && data.rating != null) {
		await refreshRouteAvgRating(routeId);
	}
	return id;
}

export async function updateClimb(
	id: string,
	data: ClimbFormValues,
	routeId?: string | null,
): Promise<void> {
	if (!isTauri()) {
		const { error } = await supabase
			.from("climbs")
			.update({
				name: data.name,
				route_type: data.route_type,
				grade: data.grade,
				moves: data.moves,
				sent_status: data.sent_status,
				country: data.country ?? null,
				area: data.area ?? null,
				sub_area: data.sub_area ?? null,
				crag: data.crag ?? null,
				wall: data.wall ?? null,
				route_location: data.route_location ?? null,
				link: data.link ?? null,
				route_id: routeId ?? null,
				sent_date: data.sent_date ?? null,
				rating: data.rating ?? null,
			})
			.eq("id", id)
			.is("deleted_at", null);
		if (error) throw error;
		return;
	}

	const db = await getDb();
	await db.execute(
		`UPDATE climbs
     SET name = ?, route_type = ?, grade = ?, moves = ?, sent_status = ?,
         country = ?, area = ?, sub_area = ?, crag = ?, wall = ?, route_location = ?, link = ?, route_id = ?, sent_date = ?, rating = ?
     WHERE id = ? AND deleted_at IS NULL`,
		[
			data.name,
			data.route_type,
			data.grade,
			data.moves,
			data.sent_status,
			data.country ?? null,
			data.area ?? null,
			data.sub_area ?? null,
			data.crag ?? null,
			data.wall ?? null,
			data.route_location ?? null,
			data.link ?? null,
			routeId ?? null,
			data.sent_date ?? null,
			data.rating ?? null,
			id,
		],
	);
	if (routeId) {
		await refreshRouteAvgRating(routeId);
	}
}

export async function updateClimbMoves(
	id: string,
	moves: string,
): Promise<void> {
	if (!isTauri()) {
		const { error } = await supabase
			.from("climbs")
			.update({ moves })
			.eq("id", id)
			.is("deleted_at", null);
		if (error) throw error;
		return;
	}
	const db = await getDb();
	await db.execute(
		"UPDATE climbs SET moves = ? WHERE id = ? AND deleted_at IS NULL",
		[moves, id],
	);
}

export async function linkClimbToRoute(
	climbId: string,
	routeId: string,
): Promise<void> {
	if (!isTauri()) {
		const { error } = await supabase
			.from("climbs")
			.update({ route_id: routeId })
			.eq("id", climbId)
			.is("deleted_at", null);
		if (error) throw error;
		return;
	}
	const db = await getDb();
	const rows = await db.select<{ rating: number | null }[]>(
		"SELECT rating FROM climbs WHERE id = ? AND deleted_at IS NULL",
		[climbId],
	);
	await db.execute(
		"UPDATE climbs SET route_id = ? WHERE id = ? AND deleted_at IS NULL",
		[routeId, climbId],
	);
	if (rows[0]?.rating != null) {
		await refreshRouteAvgRating(routeId);
	}
}

export async function unlinkClimbFromRoute(climbId: string): Promise<void> {
	if (!isTauri()) {
		const { error } = await supabase
			.from("climbs")
			.update({ route_id: null })
			.eq("id", climbId)
			.is("deleted_at", null);
		if (error) throw error;
		return;
	}
	const db = await getDb();
	const rows = await db.select<
		{ route_id: string | null; rating: number | null }[]
	>("SELECT route_id, rating FROM climbs WHERE id = ? AND deleted_at IS NULL", [
		climbId,
	]);
	await db.execute(
		"UPDATE climbs SET route_id = NULL WHERE id = ? AND deleted_at IS NULL",
		[climbId],
	);
	const routeId = rows[0]?.route_id;
	if (routeId && rows[0]?.rating != null) {
		await refreshRouteAvgRating(routeId);
	}
}

export async function fetchUnlinkedClimbs(userId: string): Promise<Climb[]> {
	if (!isTauri()) {
		const { data, error } = await supabase
			.from("climbs")
			.select("*")
			.eq("user_id", userId)
			.is("route_id", null)
			.is("deleted_at", null)
			.order("name");
		if (error) throw error;
		return (data as Climb[]) ?? [];
	}
	const db = await getDb();
	return db.select<Climb[]>(
		"SELECT * FROM climbs WHERE user_id = ? AND route_id IS NULL AND deleted_at IS NULL ORDER BY name COLLATE NOCASE ASC",
		[userId],
	);
}

export async function linkExistingClimbToRoute(
	climbId: string,
	routeId: string,
): Promise<void> {
	if (!isTauri()) {
		const loc = await fetchLocationForRoute(routeId);
		const { error } = await supabase
			.from("climbs")
			.update({
				route_id: routeId,
				country: loc.country,
				area: loc.area,
				sub_area: loc.sub_area,
				crag: loc.crag,
				wall: loc.wall,
			})
			.eq("id", climbId)
			.is("deleted_at", null);
		if (error) throw error;
		return;
	}
	const db = await getDb();
	const [loc, rows] = await Promise.all([
		fetchLocationForRoute(routeId),
		db.select<{ rating: number | null }[]>(
			"SELECT rating FROM climbs WHERE id = ? AND deleted_at IS NULL",
			[climbId],
		),
	]);
	await db.execute(
		`UPDATE climbs
     SET route_id = ?, country = ?, area = ?, sub_area = ?, crag = ?, wall = ?
     WHERE id = ? AND deleted_at IS NULL`,
		[routeId, loc.country, loc.area, loc.sub_area, loc.crag, loc.wall, climbId],
	);
	if (rows[0]?.rating != null) {
		await refreshRouteAvgRating(routeId);
	}
}

export async function patchClimbGrade(
	id: string,
	grade: string,
): Promise<void> {
	if (!isTauri()) {
		const { error } = await supabase
			.from("climbs")
			.update({ grade })
			.eq("id", id)
			.is("deleted_at", null);
		if (error) throw error;
		return;
	}
	const db = await getDb();
	await db.execute(
		"UPDATE climbs SET grade = ? WHERE id = ? AND deleted_at IS NULL",
		[grade, id],
	);
}

export async function patchClimbStatus(
	id: string,
	sentStatus: string,
): Promise<void> {
	if (!isTauri()) {
		const { error } = await supabase
			.from("climbs")
			.update({ sent_status: sentStatus })
			.eq("id", id)
			.is("deleted_at", null);
		if (error) throw error;
		return;
	}
	const db = await getDb();
	await db.execute(
		"UPDATE climbs SET sent_status = ? WHERE id = ? AND deleted_at IS NULL",
		[sentStatus, id],
	);
}

export async function patchClimbRating(
	id: string,
	rating: number | null,
): Promise<void> {
	if (!isTauri()) {
		const { error } = await supabase
			.from("climbs")
			.update({ rating })
			.eq("id", id)
			.is("deleted_at", null);
		if (error) throw error;
		return;
	}
	const db = await getDb();
	await db.execute(
		"UPDATE climbs SET rating = ? WHERE id = ? AND deleted_at IS NULL",
		[rating, id],
	);
	// Refresh avg_rating on the linked route if any
	const rows = await db.select<{ route_id: string | null }[]>(
		"SELECT route_id FROM climbs WHERE id = ? AND deleted_at IS NULL",
		[id],
	);
	const routeId = rows[0]?.route_id;
	if (routeId) {
		await refreshRouteAvgRating(routeId);
	}
}

export async function patchClimbLink(
	id: string,
	link: string | null,
): Promise<void> {
	if (!isTauri()) {
		const { error } = await supabase
			.from("climbs")
			.update({ link })
			.eq("id", id)
			.is("deleted_at", null);
		if (error) throw error;
		return;
	}
	const db = await getDb();
	await db.execute(
		"UPDATE climbs SET link = ? WHERE id = ? AND deleted_at IS NULL",
		[link, id],
	);
}

export async function setClimbOfflineAvailable(
	climbId: string,
	available: boolean,
): Promise<void> {
	if (!isTauri()) return;
	const db = await getDb();
	await db.execute("UPDATE climbs SET offline_available = ? WHERE id = ?", [
		available ? 1 : 0,
		climbId,
	]);
}

export async function softDeleteClimb(id: string): Promise<void> {
	if (!isTauri()) {
		const { error } = await supabase
			.from("climbs")
			.update({ deleted_at: new Date().toISOString() })
			.eq("id", id);
		if (error) throw error;
		return;
	}
	const db = await getDb();
	const rows = await db.select<
		{ route_id: string | null; rating: number | null }[]
	>("SELECT route_id, rating FROM climbs WHERE id = ? AND deleted_at IS NULL", [
		id,
	]);
	await db.execute(
		"UPDATE climbs SET deleted_at = datetime('now') WHERE id = ?",
		[id],
	);
	const routeId = rows[0]?.route_id;
	if (routeId && rows[0]?.rating != null) {
		await refreshRouteAvgRating(routeId);
	}
}

// ── Climb links ───────────────────────────────────────────────────────────────

export async function fetchClimbLinks(climbId: string): Promise<ClimbLink[]> {
	if (!isTauri()) {
		const { data, error } = await supabase
			.from("climb_links")
			.select("*")
			.eq("climb_id", climbId)
			.is("deleted_at", null)
			.order("created_at");
		if (error) throw error;
		return (data as ClimbLink[]) ?? [];
	}
	const db = await getDb();
	return db.select<ClimbLink[]>(
		"SELECT * FROM climb_links WHERE climb_id = ? AND deleted_at IS NULL ORDER BY created_at ASC",
		[climbId],
	);
}

export async function addClimbLink(
	climbId: string,
	userId: string,
	url: string,
	title: string | undefined,
): Promise<void> {
	const id = crypto.randomUUID();
	const { error } = await supabase.from("climb_links").insert({
		id,
		climb_id: climbId,
		user_id: userId,
		url,
		title: title ?? null,
		link_type: "link",
	});
	if (error) throw error;
	if (!isTauri()) return;
	const db = await getDb();
	await db.execute(
		`INSERT INTO climb_links (id, climb_id, user_id, url, title, link_type, created_at)
     VALUES (?, ?, ?, ?, ?, 'link', datetime('now'))`,
		[id, climbId, userId, url, title ?? null],
	);
}

export async function deleteClimbLink(id: string): Promise<void> {
	const { error } = await supabase
		.from("climb_links")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", id);
	if (error) throw error;
	if (!isTauri()) return;
	const db = await getDb();
	await db.execute("DELETE FROM climb_links WHERE id = ?", [id]);
}

// Apply a climb received from Supabase Realtime or a pull.
// Uses INSERT OR REPLACE to bypass the updated_at trigger so the
// server timestamp is preserved exactly.
export async function applyRemoteClimb(climb: Climb): Promise<void> {
	if (!isTauri()) return;
	const db = await getDb();
	await db.execute(
		`INSERT OR REPLACE INTO climbs
     (id, user_id, name, route_type, grade, moves, sent_status,
      country, area, sub_area, crag, wall, route_location, link, route_id,
      sent_date, rating, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			climb.id,
			climb.user_id,
			climb.name,
			climb.route_type,
			climb.grade,
			climb.moves,
			climb.sent_status,
			climb.country ?? null,
			climb.area ?? null,
			climb.sub_area ?? null,
			climb.crag ?? null,
			climb.wall ?? null,
			climb.route_location ?? null,
			climb.link ?? null,
			climb.route_id ?? null,
			climb.sent_date ?? null,
			climb.rating ?? null,
			climb.created_at,
			climb.updated_at,
			climb.deleted_at ?? null,
		],
	);
}
