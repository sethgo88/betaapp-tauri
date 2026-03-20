import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type {
	Route,
	RouteBodyStat,
	RouteLink,
	RouteSubmitValues,
} from "./routes.schema";

export async function fetchRoutes(wallId: string): Promise<Route[]> {
	const db = await getDb();
	return db.select<Route[]>(
		"SELECT * FROM routes_cache WHERE wall_id = ? ORDER BY name ASC",
		[wallId],
	);
}

export async function fetchRoute(id: string): Promise<Route | null> {
	const db = await getDb();
	const rows = await db.select<Route[]>(
		"SELECT * FROM routes_cache WHERE id = ?",
		[id],
	);
	return rows[0] ?? null;
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
		route_type: "sport" | "boulder";
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
	const db = await getDb();
	const like = `%${query}%`;
	return db.select<Route[]>(
		"SELECT * FROM routes_cache WHERE (name LIKE ? OR grade LIKE ?) AND status = 'verified' ORDER BY name ASC LIMIT 30",
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
	route_type: "sport" | "boulder";
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
		email: string;
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
		.order("created_at", { ascending: false });
	if (error) throw error;

	const routes = (data ?? []) as UnverifiedRoute[];

	const userIds = [...new Set(routes.map((r) => r.created_by))];
	if (userIds.length > 0) {
		const { data: users } = await supabase
			.from("users")
			.select("id, email, display_name")
			.in("id", userIds);
		if (users) {
			const userMap = new Map(users.map((u) => [u.id, u]));
			for (const route of routes) {
				const user = userMap.get(route.created_by);
				if (user) {
					route.submitter = {
						email: user.email,
						display_name: user.display_name,
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
		route_type: "sport" | "boulder";
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
	const db = await getDb();
	// Reassign climbs referencing the unverified route to the target route
	const { error: climbError } = await supabase
		.from("climbs")
		.update({ route_id: targetId })
		.eq("route_id", unverifiedId);
	if (climbError) throw climbError;
	await db.execute("UPDATE climbs SET route_id = ? WHERE route_id = ?", [
		targetId,
		unverifiedId,
	]);
	// Delete the unverified route
	const { error } = await supabase
		.from("routes")
		.delete()
		.eq("id", unverifiedId);
	if (error) throw error;
	await db.execute("DELETE FROM routes_cache WHERE id = ?", [unverifiedId]);
}

export async function adminDeleteRoute(id: string): Promise<void> {
	const db = await getDb();
	// Check if any climbs reference this route
	const [linked] = await db.select<{ count: number }[]>(
		"SELECT COUNT(*) as count FROM climbs WHERE route_id = ?",
		[id],
	);
	if (linked.count > 0) {
		throw new Error(
			`Cannot delete: ${linked.count} climb(s) are linked to this route. Unlink them first.`,
		);
	}
	const { error } = await supabase
		.from("routes")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", id);
	if (error) throw error;
	await db.execute("DELETE FROM routes_cache WHERE id = ?", [id]);
}

export async function searchVerifiedRoutes(
	query: string,
): Promise<VerifiedRouteResult[]> {
	const { data, error } = await supabase
		.from("routes")
		.select("id, name, grade, route_type, walls(name)")
		.eq("status", "verified")
		.ilike("name", `%${query}%`)
		.limit(10);
	if (error) throw error;
	return (data ?? []) as VerifiedRouteResult[];
}

// ── Route body stats ──────────────────────────────────────────────────────────

// Requires Supabase RPC:
//
// CREATE OR REPLACE FUNCTION public.get_route_body_stats(p_route_id uuid)
// RETURNS TABLE (height_cm integer, ape_index_cm integer, grade text, count bigint)
// LANGUAGE sql SECURITY DEFINER STABLE AS $$
//   SELECT u.height_cm, u.ape_index_cm, c.grade, COUNT(*) AS count
//   FROM climbs c JOIN users u ON u.id = c.user_id
//   WHERE c.route_id = p_route_id
//     AND c.sent_status IN ('sent', 'redpoint', 'flash', 'onsight')
//     AND c.deleted_at IS NULL AND u.height_cm IS NOT NULL
//   GROUP BY u.height_cm, u.ape_index_cm, c.grade;
// $$;

export async function fetchRouteBodyStats(
	routeId: string,
): Promise<RouteBodyStat[]> {
	const { data, error } = await supabase.rpc("get_route_body_stats", {
		p_route_id: routeId,
	});
	if (error) throw error;
	return (data ?? []) as RouteBodyStat[];
}

// ── Route links ───────────────────────────────────────────────────────────────

export async function fetchRouteLinks(routeId: string): Promise<RouteLink[]> {
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

	const db = await getDb();
	await db.execute("DELETE FROM route_links WHERE id = ?", [id]);
}

export async function applyRemoteRouteLink(link: RouteLink): Promise<void> {
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
