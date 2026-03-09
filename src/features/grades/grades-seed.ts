import { getDb } from "@/lib/db";

const sportGrades = [
	"5.11+",
	"5.11c/d",
	"5.11d",
	"5.12a",
	"5.12-",
	"5.12a/b",
	"5.12b",
	"5.12",
	"5.12b/c",
	"5.12c",
	"5.12c/d",
	"5.12+",
	"5.12d",
	"5.13a",
	"5.13-",
	"5.13a/b",
	"5.13b",
	"5.13",
	"5.13b/c",
	"5.13c",
	"5.13c/d",
	"5.13+",
	"5.13d",
];

const boulderGrades = [
	"v5",
	"v5+",
	"v5/6",
	"v6-",
	"v6",
	"v6+",
	"v6/7",
	"v7-",
	"v7",
	"v7+",
	"v7/8",
	"v8-",
	"v8",
	"v8+",
	"v8/9",
	"v9-",
	"v9",
	"v9+",
	"v9/10",
	"v10-",
	"v10",
	"v10+",
	"v10/11",
	"v11-",
	"v11",
];

export async function seedGrades(): Promise<void> {
	const db = await getDb();
	const existing = await db.select<[{ count: number }]>(
		"SELECT COUNT(*) as count FROM grades_cache",
	);
	if (existing[0].count > 0) return;

	for (let i = 0; i < sportGrades.length; i++) {
		await db.execute(
			"INSERT INTO grades_cache (id, discipline, grade, sort_order) VALUES (?, ?, ?, ?)",
			[crypto.randomUUID(), "sport", sportGrades[i], i],
		);
	}
	for (let i = 0; i < boulderGrades.length; i++) {
		await db.execute(
			"INSERT INTO grades_cache (id, discipline, grade, sort_order) VALUES (?, ?, ?, ?)",
			[crypto.randomUUID(), "boulder", boulderGrades[i], i],
		);
	}
}
