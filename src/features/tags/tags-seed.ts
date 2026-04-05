import { getDb } from "@/lib/db";

const TAGS = [
	"bouldery",
	"chossy",
	"crimpy",
	"dynamic",
	"juggy",
	"morpho",
	"polished",
	"pockety",
	"powerful",
	"pumpy",
	"reachy",
	"roof",
	"scrunchy",
	"short",
	"slaby",
	"slopey",
	"steep",
	"sustained",
	"tall",
	"techy",
	"vert",
];

export async function seedTags(): Promise<void> {
	const db = await getDb();
	const existing = await db.select<[{ count: number }]>(
		"SELECT COUNT(*) as count FROM tags_cache",
	);
	if (existing[0].count === TAGS.length) return;

	await db.execute("DELETE FROM tags_cache");
	for (let i = 0; i < TAGS.length; i++) {
		await db.execute(
			"INSERT INTO tags_cache (id, name, sort_order) VALUES (?, ?, ?)",
			[crypto.randomUUID(), TAGS[i], i],
		);
	}
}
