import { getDb } from "@/lib/db";
import type { Grade } from "./grades.schema";

export async function fetchGrades(
	discipline: "sport" | "boulder",
): Promise<Grade[]> {
	const db = await getDb();
	return db.select<Grade[]>(
		"SELECT * FROM grades_cache WHERE discipline = ? ORDER BY sort_order ASC",
		[discipline],
	);
}
