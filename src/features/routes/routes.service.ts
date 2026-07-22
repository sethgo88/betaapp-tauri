import { isTauri } from "@tauri-apps/api/core";
import { getDb } from "@/lib/db";
import type { SunData } from "@/lib/sun";
import { supabase } from "@/lib/supabase";
import type {
	Route,
	RouteBodyStat,
	RouteLink,
	RouteSubmitValues,
} from "./routes.schema";

export async function refreshRouteAvgRating(routeId: string): Promise<void> {
	if (!isTauri()) return; // avg_rating on routes is admin-managed in Supabase
	const db = await getDb();
	const rows = await db.select<{ avg: number | null; cnt: number }[]>(
		"SELECT AVG(rating) as avg, COUNT(rating) as cnt FROM climbs WHERE route_id = ? AND rating IS NOT NULL AND deleted_at IS NULL",
		[routeId],
	);
	const raw = rows[0]?.avg ?? null;
	const avg = raw != null ? Math.round(raw * 10) / 10 : null;
	const count = rows[0]?.cnt ?? 0;
	await db.execute(
		"UPDATE routes_cache SET avg_rating = ?, rating_count = ? WHERE id = ?",
		[avg, count, routeId],
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

export async function fetchRoutes(wallId: string): Promise<Route[]> {
	if (!isTauri()) {
		const { data, error } = await supabase
			.from("routes")
			.select("*")
			.eq("wall_id", wallId)
			.eq("status", "verified")
			.is("deleted_at", null)
			.order("sort_order")
			.order("name");
		if (error) throw error;
		return (data ?? []).map(parseSunData) as Route[];
	}
	const db = await getDb();
	const rows = await db.select<Route[]>(
		"SELECT * FROM routes_cache WHERE wall_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC",
		[wallId],
	);
	return rows.map(parseSunData);
}

export async function reorderRoutes(orderedIds: string[]): Promise<void> {
	const db = isTauri() ? await getDb() : null;
	for (let i = 0; i < orderedIds.length; i++) {
		// biome-ignore lint/suspicious/noExplicitAny: sort_order not yet in generated types
		const { error } = await (supabase as any)
			.from("routes")
			.update({ sort_order: i })
			.eq("id", orderedIds[i]);
		if (error) throw error;
		if (!db) continue;
		await db.execute("UPDATE routes_cache SET sort_order = ? WHERE id = ?", [
			i,
			orderedIds[i],
		]);
	}
}

export async function fetchRoute(id: string): Promise<Route | null> {
	if (!isTauri()) {
		const { data, error } = await supabase
			.from("routes")
			.select("*")
			.eq("id", id)
			.is("deleted_at", null)
			.single();
		if (error && error.code !== "PGRST116") throw error;
		return data ? (parseSunData(data) as Route) : null;
	}
	const db = await getDb();
	const rows = await db.select<Route[]>(
		"SELECT * FROM routes_cache WHERE id = ? AND deleted_at IS NULL",
		[id],
	);
	return rows[0] ? parseSunData(rows[0]) : null;
}

export async function addRoute(
	values: RouteSubmitValues,
	userId: string,
	isAdmin: boolean,
): Promise<string> {
	const id = crypto.randomUUID();
	const status = isAdmin ? "verified" : "pending";

	const { error } = await supabase.from("routes").insert({
		id,
		wall_id: values.wall_id,
		name: values.name,
		grade: values.grade,
		route_type: values.route_type,
		description: values.description ?? null,
		status,
		created_by: userId,
	});
	if (error) throw error;
	if (!isTauri()) return id;

	const db = await getDb();
	await db.execute(
		`INSERT INTO routes_cache
       (id, wall_id, name, grade, route_type, description, status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
		[
			id,
			values.wall_id,
			values.name,
			values.grade,
			values.route_type,
			values.description ?? null,
			status,
			userId,
		],
	);
	return id;
}

export async function editRoute(
	id: string,
	values: {
		wall_id: string;
		name: string;
		grade: string;
		route_type: "sport" | "boulder" | "trad";
		description?: string;
	},
): Promise<void> {
	const { error } = await supabase
		.from("routes")
		.update({
			wall_id: values.wall_id,
			name: values.name,
			grade: values.grade,
			route_type: values.route_type,
			description: values.description ?? null,
		})
		.eq("id", id);
	if (error) throw error;
	if (!isTauri()) return;

	const db = await getDb();
	await db.execute(
		"UPDATE routes_cache SET wall_id = ?, name = ?, grade = ?, route_type = ?, description = ? WHERE id = ?",
		[
			values.wall_id,
			values.name,
			values.grade,
			values.route_type,
			values.description ?? null,
			id,
		],
	);
}

export async function searchLocalRoutes(query: string): Promise<Route[]> {
	if (!isTauri()) {
		const like = `%${query}%`;
		const { data, error } = await supabase
			.from("routes")
			.select("*")
			.eq("status", "verified")
			.is("deleted_at", null)
			.or(`name.ilike.${like},grade.ilike.${like}`)
			.order("name")
			.limit(30);
		if (error) throw error;
		return (data ?? []) as Route[];
	}
	const db = await getDb();
	const like = `%${query}%`;
	return db.select<Route[]>(
		"SELECT * FROM routes_cache WHERE (name LIKE ? OR grade LIKE ?) AND status = 'verified' AND deleted_at IS NULL ORDER BY name ASC LIMIT 30",
		[like, like],
	);
}

export async function updateRouteDescription(
	id: string,
	description: string,
): Promise<void> {
	const { error } = await supabase
		.from("routes")
		.update({ description })
		.eq("id", id);
	if (error) throw error;
	if (!isTauri()) return;

	const db = await getDb();
	await db.execute("UPDATE routes_cache SET description = ? WHERE id = ?", [
		description,
		id,
	]);
}

// ── Admin verification ────────────────────────────────────────────────────────

export type UnverifiedRoute = {
	id: string;
	wall_id: string;
	name: string;
	grade: string;
	route_type: "sport" | "boulder" | "trad";
	description: string | null;
	status: "pending" | "verified" | "rejected";
	created_by: string;
	created_at: string;
	walls: {
		name: string;
		crags: {
			name: string;
			sub_regions: {
				name: string;
				regions: {
					id: string;
					name: string;
					countries: { name: string };
				};
			};
		};
	} | null;
	submitter?: {
		display_name: string | null;
	};
};

export type VerifiedRouteResult = {
	id: string;
	name: string;
	grade: string;
	route_type: string;
	walls: { name: string } | null;
};

export async function fetchUnverifiedRoutes(): Promise<UnverifiedRoute[]> {
	const { data, error } = await supabase
		.from("routes")
		.select(
			"id, wall_id, name, grade, route_type, description, status, created_by, created_at, walls(name, crags(name, sub_regions(name, regions(id, name, countries(name)))))",
		)
		.eq("status", "pending")
		.is("deleted_at", null)
		.order("created_at", { ascending: false });
	if (error) throw error;

	const routes = (data ?? []) as UnverifiedRoute[];

	const userIds = [...new Set(routes.map((r) => r.created_by))];
	if (userIds.length > 0) {
		const { data: profiles } = await supabase
			.from("profiles")
			.select("id, display_name")
			.in("id", userIds);
		if (profiles) {
			const profileMap = new Map(profiles.map((p) => [p.id, p]));
			for (const route of routes) {
				const profile = profileMap.get(route.created_by);
				if (profile) {
					route.submitter = {
						display_name: profile.display_name,
					};
				}
			}
		}
	}

	return routes;
}

export async function fetchAllRoutes(): Promise<UnverifiedRoute[]> {
	const { data, error } = await supabase
		.from("routes")
		.select(
			"id, wall_id, name, grade, route_type, description, status, created_by, created_at, walls(name, crags(name, sub_regions(name, regions(id, name, countries(name)))))",
		)
		.is("deleted_at", null)
		.order("created_at", { ascending: false });
	if (error) throw error;
	return (data ?? []) as UnverifiedRoute[];
}

export async function verifyRoute(id: string): Promise<void> {
	const { error } = await supabase
		.from("routes")
		.update({ status: "verified" })
		.eq("id", id);
	if (error) throw error;
	if (!isTauri()) return;

	const db = await getDb();
	await db.execute("UPDATE routes_cache SET status = 'verified' WHERE id = ?", [
		id,
	]);
}

export async function rejectRoute(id: string): Promise<void> {
	const { error } = await supabase
		.from("routes")
		.update({ status: "rejected" })
		.eq("id", id);
	if (error) throw error;
	if (!isTauri()) return;

	const db = await getDb();
	await db.execute("UPDATE routes_cache SET status = 'rejected' WHERE id = ?", [
		id,
	]);
}

export async function updateRouteFields(
	id: string,
	values: {
		name: string;
		grade: string;
		route_type: "sport" | "boulder" | "trad";
		description?: string;
	},
): Promise<void> {
	const { error } = await supabase
		.from("routes")
		.update({
			name: values.name,
			grade: values.grade,
			route_type: values.route_type,
			description: values.description ?? null,
		})
		.eq("id", id);
	if (error) throw error;
	if (!isTauri()) return;

	const db = await getDb();
	await db.execute(
		"UPDATE routes_cache SET name = ?, grade = ?, route_type = ?, description = ? WHERE id = ?",
		[
			values.name,
			values.grade,
			values.route_type,
			values.description ?? null,
			id,
		],
	);
}

export async function mergeRoute(
	unverifiedId: string,
	targetId: string,
): Promise<void> {
	const { error: climbError } = await supabase
		.from("climbs")
		.update({ route_id: targetId })
		.eq("route_id", unverifiedId);
	if (climbError) throw climbError;

	const { error } = await supabase
		.from("routes")
		.delete()
		.eq("id", unverifiedId);
	if (error) throw error;

	if (!isTauri()) return;

	const db = await getDb();
	await db.execute("UPDATE climbs SET route_id = ? WHERE route_id = ?", [
		targetId,
		unverifiedId,
	]);
	await db.execute("DELETE FROM routes_cache WHERE id = ?", [unverifiedId]);
}

export async function adminDeleteRoute(id: string): Promise<void> {
	const { error: unlinkError } = await supabase
		.from("climbs")
		.update({ route_id: null })
		.eq("route_id", id);
	if (unlinkError) throw unlinkError;

	const { error } = await supabase
		.from("routes")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", id);
	if (error) throw error;

	if (!isTauri()) return;

	const db = await getDb();
	await db.execute("UPDATE climbs SET route_id = NULL WHERE route_id = ?", [id]);
	await db.execute("DELETE FROM routes_cache WHERE id = ?", [id]);
}

export async function searchVerifiedRoutes(
	query: string,
): Promise<VerifiedRouteResult[]> {
	const { data, error } = await supabase
		.from("routes")
		.select("id, name, grade, route_type, walls(name)")
		.eq("status", "verified")
		.is("deleted_at", null)
		.ilike("name", `%${query}%`)
		.limit(10);
	if (error) throw error;
	return (data ?? []) as VerifiedRouteResult[];
}

// ── Route body stats ──────────────────────────────────────────────────────────

export async function fetchRouteBodyStats(
	routeId: string,
): Promise<RouteBodyStat[]> {
	// biome-ignore lint/suspicious/noExplicitAny: get_route_body_stats not in generated types
	const { data, error } = await (supabase as any).rpc("get_route_body_stats", {
		p_route_id: routeId,
	});
	if (error) throw error;
	return (data ?? []) as RouteBodyStat[];
}

// ── Route links ───────────────────────────────────────────────────────────────

export async function fetchRouteLinks(routeId: string): Promise<RouteLink[]> {
	if (!isTauri()) {
		const { data, error } = await supabase
			.from("route_links")
			.select("*")
			.eq("route_id", routeId)
			.is("deleted_at", null)
			.order("created_at");
		if (error) throw error;
		return (data as RouteLink[]) ?? [];
	}
	const db = await getDb();
	return db.select<RouteLink[]>(
		"SELECT * FROM route_links WHERE route_id = ? AND deleted_at IS NULL ORDER BY created_at ASC",
		[routeId],
	);
}

export async function addRouteLink(
	routeId: string,
	userId: string,
	url: string,
	title: string | undefined,
): Promise<void> {
	const id = crypto.randomUUID();
	const { error } = await supabase.from("route_links").insert({
		id,
		route_id: routeId,
		user_id: userId,
		url,
		title: title ?? null,
		link_type: "link",
	});
	if (error) throw error;
	if (!isTauri()) return;

	const db = await getDb();
	await db.execute(
		`INSERT INTO route_links (id, route_id, user_id, url, title, link_type, created_at)
     VALUES (?, ?, ?, ?, ?, 'link', datetime('now'))`,
		[id, routeId, userId, url, title ?? null],
	);
}

export async function deleteRouteLink(id: string): Promise<void> {
	const { error } = await supabase
		.from("route_links")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", id);
	if (error) throw error;
	if (!isTauri()) return;

	const db = await getDb();
	await db.execute("DELETE FROM route_links WHERE id = ?", [id]);
}

export async function applyRemoteRouteLink(link: RouteLink): Promise<void> {
	if (!isTauri()) return;
	const db = await getDb();
	if (link.deleted_at) {
		await db.execute("DELETE FROM route_links WHERE id = ?", [link.id]);
		return;
	}
	await db.execute(
		`INSERT OR REPLACE INTO route_links
     (id, route_id, user_id, url, title, link_type, created_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			link.id,
			link.route_id,
			link.user_id,
			link.url,
			link.title ?? null,
			link.link_type,
			link.created_at,
			link.deleted_at ?? null,
		],
	);
}

// ── Sun data ─────────────────────────────────────────────────────────────────

export async function updateRouteSunData(
	routeId: string,
	data: SunData | null,
): Promise<void> {
	const serialized = data !== null ? JSON.stringify(data) : null;
	// biome-ignore lint/suspicious/noExplicitAny: sun_data not yet in generated Supabase types
	const { error } = await (supabase as any)
		.from("routes")
		.update({ sun_data: data })
		.eq("id", routeId);
	if (error) throw error;
	if (!isTauri()) return;

	const db = await getDb();
	await db.execute("UPDATE routes_cache SET sun_data = ? WHERE id = ?", [
		serialized,
		routeId,
	]);
}
