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

	// Insert to local cache so the creator can see it immediately
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
