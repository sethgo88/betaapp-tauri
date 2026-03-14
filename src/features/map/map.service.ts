import { getDb } from "@/lib/db";

export type PersonalCrag = {
	id: string;
	name: string;
	lat: number;
	lng: number;
	route_count: number;
	climb_count: number;
	has_sent: boolean;
	has_project: boolean;
	has_todo: boolean;
};

export async function fetchPersonalCrags(
	userId: string,
): Promise<PersonalCrag[]> {
	const db = await getDb();
	const rows = await db.select<
		{
			id: string;
			name: string;
			lat: number;
			lng: number;
			route_count: number;
			climb_count: number;
			sent_count: number;
			project_count: number;
			todo_count: number;
		}[]
	>(
		`SELECT
			c.id,
			c.name,
			c.lat,
			c.lng,
			(SELECT COUNT(*) FROM routes_cache r2
			 JOIN walls_cache w2 ON r2.wall_id = w2.id
			 WHERE w2.crag_id = c.id) AS route_count,
			COUNT(DISTINCT cl.id) AS climb_count,
			SUM(CASE WHEN cl.sent_status IN ('sent', 'flash', 'redpoint', 'onsight') THEN 1 ELSE 0 END) AS sent_count,
			SUM(CASE WHEN cl.sent_status = 'project' THEN 1 ELSE 0 END) AS project_count,
			SUM(CASE WHEN cl.sent_status = 'todo' THEN 1 ELSE 0 END) AS todo_count
		FROM crags_cache c
		JOIN walls_cache w ON w.crag_id = c.id
		JOIN routes_cache r ON r.wall_id = w.id
		JOIN climbs cl ON cl.route_id = r.id
		WHERE c.lat IS NOT NULL
			AND c.lng IS NOT NULL
			AND cl.user_id = ?
			AND cl.deleted_at IS NULL
		GROUP BY c.id`,
		[userId],
	);

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		lat: r.lat,
		lng: r.lng,
		climb_count: r.climb_count,
		route_count: r.route_count,
		has_sent: r.sent_count > 0,
		has_project: r.project_count > 0,
		has_todo: r.todo_count > 0,
	}));
}
