import { getDb } from "@/lib/db";
import type { User } from "./auth.schema";

export async function fetchCurrentUser(): Promise<User | null> {
	const db = await getDb();
	const rows = await db.select<User[]>(
		"SELECT * FROM users WHERE deleted_at IS NULL LIMIT 1",
	);
	return rows[0] ?? null;
}

export async function insertUser(email: string): Promise<User> {
	const db = await getDb();
	const id = crypto.randomUUID();
	await db.execute(
		"INSERT INTO users (id, email, role) VALUES (?, ?, 'user')",
		[id, email],
	);
	const rows = await db.select<User[]>("SELECT * FROM users WHERE id = ?", [
		id,
	]);
	return rows[0];
}

export async function updateUserEmail(
	id: string,
	email: string,
): Promise<void> {
	const db = await getDb();
	await db.execute("UPDATE users SET email = ? WHERE id = ?", [email, id]);
}
