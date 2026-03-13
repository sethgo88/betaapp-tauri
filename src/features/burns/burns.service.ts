import { getDb } from "@/lib/db";
import type { Burn, BurnFormValues } from "./burns.schema";

export async function fetchBurns(climbId: string): Promise<Burn[]> {
	const db = await getDb();
	return db.select<Burn[]>(
		"SELECT * FROM burns WHERE climb_id = ? AND deleted_at IS NULL ORDER BY date ASC",
		[climbId],
	);
}

export async function insertBurn(
	climbId: string,
	userId: string,
	data: BurnFormValues,
): Promise<void> {
	const db = await getDb();
	const id = crypto.randomUUID();
	await db.execute(
		`INSERT INTO burns (id, climb_id, user_id, date, outcome, notes)
     VALUES (?, ?, ?, ?, 'attempt', ?)`,
		[id, climbId, userId, data.date, data.notes ?? null],
	);
}

export async function updateBurn(
	id: string,
	data: BurnFormValues,
): Promise<void> {
	const db = await getDb();
	await db.execute(
		`UPDATE burns SET date = ?, notes = ?
     WHERE id = ? AND deleted_at IS NULL`,
		[data.date, data.notes ?? null, id],
	);
}

export async function softDeleteBurn(id: string): Promise<void> {
	const db = await getDb();
	await db.execute(
		"UPDATE burns SET deleted_at = datetime('now') WHERE id = ?",
		[id],
	);
}

export async function applyRemoteBurn(burn: Burn): Promise<void> {
	const db = await getDb();
	await db.execute(
		`INSERT OR REPLACE INTO burns
     (id, climb_id, user_id, date, outcome, notes,
      created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			burn.id,
			burn.climb_id,
			burn.user_id,
			burn.date,
			burn.outcome,
			burn.notes ?? null,
			burn.created_at,
			burn.updated_at,
			burn.deleted_at ?? null,
		],
	);
}
