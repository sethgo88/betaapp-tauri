import { getDb } from "@/lib/db";

const sportGrades = [
	// 5.5
	"5.5-",
	"5.5",
	"5.5+",
	// 5.6
	"5.6-",
	"5.6",
	"5.6+",
	// 5.7
	"5.7-",
	"5.7",
	"5.7+",
	// 5.8
	"5.8-",
	"5.8",
	"5.8+",
	// 5.9
	"5.9-",
	"5.9",
	"5.9+",
	// 5.10
	"5.10a",
	"5.10-",
	"5.10a/b",
	"5.10b",
	"5.10",
	"5.10b/c",
	"5.10c",
	"5.10c/d",
	"5.10+",
	"5.10d",
	// 5.11
	"5.11a",
	"5.11-",
	"5.11a/b",
	"5.11b",
	"5.11",
	"5.11b/c",
	"5.11c",
	"5.11c/d",
	"5.11+",
	"5.11d",
	// 5.12
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
	// 5.13
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
	// 5.14
	"5.14a",
	"5.14-",
	"5.14a/b",
	"5.14b",
	"5.14",
	"5.14b/c",
	"5.14c",
	"5.14c/d",
	"5.14+",
	"5.14d",
	// 5.15
	"5.15a",
	// Project grades
	"Open Project",
	"Closed Project",
];

const boulderGrades = [
	// v0
	"v0",
	"v0+",
	"v0/1",
	// v1
	"v1-",
	"v1",
	"v1+",
	"v1/2",
	// v2
	"v2-",
	"v2",
	"v2+",
	"v2/3",
	// v3
	"v3-",
	"v3",
	"v3+",
	"v3/4",
	// v4
	"v4-",
	"v4",
	"v4+",
	"v4/5",
	// v5
	"v5-",
	"v5",
	"v5+",
	"v5/6",
	// v6
	"v6-",
	"v6",
	"v6+",
	"v6/7",
	// v7
	"v7-",
	"v7",
	"v7+",
	"v7/8",
	// v8
	"v8-",
	"v8",
	"v8+",
	"v8/9",
	// v9
	"v9-",
	"v9",
	"v9+",
	"v9/10",
	// v10
	"v10-",
	"v10",
	"v10+",
	"v10/11",
	// v11
	"v11-",
	"v11",
	"v11+",
	"v11/12",
	// v12
	"v12-",
	"v12",
	"v12+",
	"v12/13",
	// v13
	"v13-",
	"v13",
	"v13+",
	"v13/14",
	// v14
	"v14-",
	"v14",
	"v14+",
	"v14/15",
	// v15
	"v15-",
	"v15",
	"v15+",
	"v15/16",
	// v16
	"v16-",
	"v16",
	"v16+",
	"v16/17",
	// v17
	"v17-",
	"v17",
];

export async function seedGrades(): Promise<void> {
	const db = await getDb();
	const existing = await db.select<[{ count: number }]>(
		"SELECT COUNT(*) as count FROM grades_cache",
	);
	const expectedCount = sportGrades.length + boulderGrades.length;
	if (existing[0].count === expectedCount) return;

	// Count mismatch — clear and re-seed (handles grade list expansions)
	await db.execute("DELETE FROM grades_cache");

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
