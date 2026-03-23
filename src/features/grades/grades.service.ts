import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Grade } from "./grades.schema";

export async function fetchGrades(
	discipline: "sport" | "boulder" | "trad",
): Promise<Grade[]> {
	const db = await getDb();
	return db.select<Grade[]>(
		"SELECT * FROM grades_cache WHERE discipline = ? ORDER BY sort_order ASC",
		[discipline],
	);
}

export async function pullGrades(): Promise<void> {
	const { data, error } = await supabase.from("grades").select("*");
	if (error) throw error;
	if (!data || data.length === 0) return;

	const db = await getDb();
	await db.execute("DELETE FROM grades_cache");
	for (const row of data as Grade[]) {
		await db.execute(
			`INSERT INTO grades_cache (id, discipline, grade, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?)`,
			[row.id, row.discipline, row.grade, row.sort_order, row.created_at],
		);
	}
}
