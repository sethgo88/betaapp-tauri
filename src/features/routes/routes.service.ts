import { getDb } from "@/lib/db";
import type { Route } from "./routes.schema";

export async function fetchRoutes(wallId: string): Promise<Route[]> {
	const db = await getDb();
	return db.select<Route[]>(
		"SELECT * FROM routes_cache WHERE wall_id = ? ORDER BY name ASC",
		[wallId],
	);
}
