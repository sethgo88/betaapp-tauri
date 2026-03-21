import { getDb } from "@/lib/db";

export type PersonalCrag = {
	id: string;
	name: string;
	lat: number;
	lng: number;
	approach: string | null;
	route_count: number;
	climb_count: number;
	sent_count: number;
	project_count: number;
	todo_count: number;
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
			approach: string | null;
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
			c.approach,
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
		sent_count: r.sent_count,
		project_count: r.project_count,
		todo_count: r.todo_count,
		has_sent: r.sent_count > 0,
		has_project: r.project_count > 0,
		has_todo: r.todo_count > 0,
	}));
}

export type PersonalWall = {
	id: string;
	crag_id: string;
	name: string;
	crag_name: string;
	lat: number;
	lng: number;
	approach: string | null;
	route_count: number;
	sent_count: number;
	project_count: number;
	todo_count: number;
};

export type PinClimb = {
	id: string;
	name: string;
	grade: string;
	sent_status: string;
};

export async function fetchClimbsAtPin(
	userId: string,
	pinType: "crag" | "wall",
	pinId: string,
): Promise<PinClimb[]> {
	const db = await getDb();
	if (pinType === "crag") {
		return db.select<PinClimb[]>(
			`SELECT cl.id, cl.name, cl.grade, cl.sent_status
			 FROM climbs cl
			 JOIN routes_cache r ON r.id = cl.route_id
			 JOIN walls_cache w ON w.id = r.wall_id
			 WHERE w.crag_id = ?
			   AND cl.user_id = ?
			   AND cl.deleted_at IS NULL
			 ORDER BY cl.name COLLATE NOCASE ASC`,
			[pinId, userId],
		);
	}
	return db.select<PinClimb[]>(
		`SELECT cl.id, cl.name, cl.grade, cl.sent_status
		 FROM climbs cl
		 JOIN routes_cache r ON r.id = cl.route_id
		 WHERE r.wall_id = ?
		   AND cl.user_id = ?
		   AND cl.deleted_at IS NULL
		 ORDER BY cl.name COLLATE NOCASE ASC`,
		[pinId, userId],
	);
}

export async function fetchPersonalWalls(
	userId: string,
): Promise<PersonalWall[]> {
	const db = await getDb();
	return db.select<PersonalWall[]>(
		`SELECT
			w.id,
			w.crag_id,
			w.name,
			c.name AS crag_name,
			w.lat,
			w.lng,
			w.approach,
			(SELECT COUNT(*) FROM routes_cache r2 WHERE r2.wall_id = w.id) AS route_count,
			SUM(CASE WHEN cl.sent_status IN ('sent', 'flash', 'redpoint', 'onsight') THEN 1 ELSE 0 END) AS sent_count,
			SUM(CASE WHEN cl.sent_status = 'project' THEN 1 ELSE 0 END) AS project_count,
			SUM(CASE WHEN cl.sent_status = 'todo' THEN 1 ELSE 0 END) AS todo_count
		FROM walls_cache w
		JOIN crags_cache c ON c.id = w.crag_id
		JOIN routes_cache r ON r.wall_id = w.id
		JOIN climbs cl ON cl.route_id = r.id
		WHERE w.lat IS NOT NULL
			AND w.lng IS NOT NULL
			AND cl.user_id = ?
			AND cl.deleted_at IS NULL
		GROUP BY w.id`,
		[userId],
	);
}
