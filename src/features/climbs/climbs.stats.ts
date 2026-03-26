import { getDb } from "@/lib/db";

export type Discipline = "sport" | "boulder";

// ── Grade distribution (stacked by status group) ──────────────────────────────

export type GradeStatusBucket = {
	grade: string;
	sort_order: number;
	sent: number;
	project: number;
	todo: number;
};

const SENT_STATUSES = "'sent','redpoint','flash','onsight'";

export async function fetchGradeDistribution(
	userId: string,
	discipline: Discipline,
): Promise<GradeStatusBucket[]> {
	const db = await getDb();

	type Row = {
		grade: string;
		sort_order: number;
		sent_group: string;
		count: number;
	};

	const rows = await db.select<Row[]>(
		`SELECT
      c.grade,
      COALESCE(g.sort_order, 9999) AS sort_order,
      CASE
        WHEN c.sent_status IN (${SENT_STATUSES}) THEN 'sent'
        ELSE c.sent_status
      END AS sent_group,
      COUNT(*) AS count
    FROM climbs c
    LEFT JOIN grades_cache g ON g.discipline = c.route_type AND g.grade = c.grade
    WHERE c.user_id = ? AND c.deleted_at IS NULL AND c.route_type = ?
    GROUP BY c.grade, sent_group
    ORDER BY sort_order ASC, c.grade ASC`,
		[userId, discipline],
	);

	// Pivot rows into GradeStatusBucket
	const map = new Map<string, GradeStatusBucket>();
	for (const row of rows) {
		let bucket = map.get(row.grade);
		if (!bucket) {
			bucket = {
				grade: row.grade,
				sort_order: row.sort_order,
				sent: 0,
				project: 0,
				todo: 0,
			};
			map.set(row.grade, bucket);
		}
		if (row.sent_group === "sent") bucket.sent += row.count;
		else if (row.sent_group === "project") bucket.project += row.count;
		else if (row.sent_group === "todo") bucket.todo += row.count;
	}

	return [...map.values()].sort((a, b) => a.sort_order - b.sort_order);
}

// ── Sends per month ───────────────────────────────────────────────────────────

export type MonthSendCount = {
	month: string; // "YYYY-MM"
	count: number;
};

export async function fetchSendsPerMonth(
	userId: string,
	discipline: Discipline,
): Promise<MonthSendCount[]> {
	const db = await getDb();
	return db.select<MonthSendCount[]>(
		`SELECT
      strftime('%Y-%m', c.created_at) AS month,
      COUNT(*) AS count
    FROM climbs c
    WHERE c.user_id = ?
      AND c.deleted_at IS NULL
      AND c.route_type = ?
      AND c.sent_status IN (${SENT_STATUSES})
    GROUP BY month
    ORDER BY month ASC`,
		[userId, discipline],
	);
}

// ── Burns per send at each grade ──────────────────────────────────────────────

export type BurnsPerSend = {
	grade: string;
	sort_order: number;
	burns_per_send: number;
};

export async function fetchBurnsPerSend(
	userId: string,
	discipline: Discipline,
): Promise<BurnsPerSend[]> {
	const db = await getDb();

	type Row = {
		grade: string;
		sort_order: number;
		burn_count: number;
		send_count: number;
	};

	const rows = await db.select<Row[]>(
		`SELECT
      c.grade,
      COALESCE(g.sort_order, 9999) AS sort_order,
      COUNT(b.id) AS burn_count,
      COUNT(DISTINCT c.id) AS send_count
    FROM climbs c
    LEFT JOIN burns b ON b.climb_id = c.id AND b.deleted_at IS NULL
    LEFT JOIN grades_cache g ON g.discipline = c.route_type AND g.grade = c.grade
    WHERE c.user_id = ?
      AND c.deleted_at IS NULL
      AND c.route_type = ?
      AND c.sent_status IN (${SENT_STATUSES})
    GROUP BY c.grade
    ORDER BY sort_order ASC`,
		[userId, discipline],
	);

	return rows
		.filter((r) => r.send_count > 0)
		.map((r) => ({
			grade: r.grade,
			sort_order: r.sort_order,
			burns_per_send: Math.round((r.burn_count / r.send_count) * 10) / 10,
		}));
}

// ── Combined stats (single query trip) ───────────────────────────────────────

export type ClimbStats = {
	gradeDistribution: GradeStatusBucket[];
	sendsPerMonth: MonthSendCount[];
	burnsPerSend: BurnsPerSend[];
};

export async function fetchClimbStats(
	userId: string,
	discipline: Discipline,
): Promise<ClimbStats> {
	const [gradeDistribution, sendsPerMonth, burnsPerSend] = await Promise.all([
		fetchGradeDistribution(userId, discipline),
		fetchSendsPerMonth(userId, discipline),
		fetchBurnsPerSend(userId, discipline),
	]);
	return { gradeDistribution, sendsPerMonth, burnsPerSend };
}
