import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Route, RouteSubmitValues } from "./routes.schema";

export async function fetchRoutes(wallId: string): Promise<Route[]> {
	const db = await getDb();
	return db.select<Route[]>(
		"SELECT * FROM routes_cache WHERE wall_id = ? ORDER BY name ASC",
		[wallId],
	);
}

export async function submitRoute(
	values: RouteSubmitValues,
	userId: string,
): Promise<void> {
	const id = crypto.randomUUID();

	const { error } = await supabase.from("routes").insert({
		id,
		wall_id: values.wall_id,
		name: values.name,
		grade: values.grade,
		route_type: values.route_type,
		description: values.description ?? null,
		verified: false,
		created_by: userId,
	});
	if (error) throw error;

	const db = await getDb();
	await db.execute(
		`INSERT INTO routes_cache
       (id, wall_id, name, grade, route_type, description, verified, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
		[
			id,
			values.wall_id,
			values.name,
			values.grade,
			values.route_type,
			values.description ?? null,
			0,
			userId,
		],
	);
}

// ── Admin verification ────────────────────────────────────────────────────────

export type UnverifiedRoute = {
	id: string;
	wall_id: string;
	name: string;
	grade: string;
	route_type: "sport" | "boulder";
	description: string | null;
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
			"id, wall_id, name, grade, route_type, description, created_by, created_at, walls(name, crags(name, sub_regions(name, regions(id, name, countries(name)))))",
		)
		.eq("verified", false)
		.order("created_at", { ascending: false });
	if (error) throw error;
	return (data ?? []) as UnverifiedRoute[];
}

export async function verifyRoute(id: string): Promise<void> {
	const { error } = await supabase
		.from("routes")
		.update({ verified: true })
		.eq("id", id);
	if (error) throw error;
	const db = await getDb();
	await db.execute("UPDATE routes_cache SET verified = 1 WHERE id = ?", [id]);
}

export async function rejectRoute(id: string): Promise<void> {
	const { error } = await supabase.from("routes").delete().eq("id", id);
	if (error) throw error;
	const db = await getDb();
	await db.execute("DELETE FROM routes_cache WHERE id = ?", [id]);
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

export async function mergeRoute(unverifiedId: string): Promise<void> {
	// Deletes the unverified duplicate. Climb reference updates deferred to Phase 10.
	const { error } = await supabase
		.from("routes")
		.delete()
		.eq("id", unverifiedId);
	if (error) throw error;
	const db = await getDb();
	await db.execute("DELETE FROM routes_cache WHERE id = ?", [unverifiedId]);
}

export async function searchVerifiedRoutes(
	query: string,
): Promise<VerifiedRouteResult[]> {
	const { data, error } = await supabase
		.from("routes")
		.select("id, name, grade, route_type, walls(name)")
		.eq("verified", true)
		.ilike("name", `%${query}%`)
		.limit(10);
	if (error) throw error;
	return (data ?? []) as VerifiedRouteResult[];
}
