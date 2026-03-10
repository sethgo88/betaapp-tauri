import type { Session } from "@supabase/supabase-js";
import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { User } from "./auth.schema";

// ── Sign in ──────────────────────────────────────────────────────────────────

export async function signIn(
	email: string,
	password: string,
): Promise<Session> {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});
	if (error) throw error;
	return data.session;
}

// ── Sign up ──────────────────────────────────────────────────────────────────

export async function signUp(
	email: string,
	password: string,
): Promise<Session> {
	const { data, error } = await supabase.auth.signUp({ email, password });
	if (error) throw error;
	if (!data.session)
		throw new Error(
			"Account created but no session returned — ensure email confirmation is disabled in Supabase.",
		);
	return data.session;
}

// ── Session restore ──────────────────────────────────────────────────────────

export async function restoreSession(): Promise<Session | null> {
	const {
		data: { session },
	} = await supabase.auth.getSession();
	return session;
}

// ── Sign out ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
	await supabase.auth.signOut();
}

// ── Local user sync ──────────────────────────────────────────────────────────

export async function upsertLocalUser(
	id: string,
	email: string,
	role: "user" | "admin",
): Promise<User> {
	const db = await getDb();

	// If a local user exists with a different ID (pre-auth UUID), migrate their climbs
	const existing = await db.select<{ id: string }[]>(
		"SELECT id FROM users WHERE deleted_at IS NULL LIMIT 1",
	);
	if (existing.length > 0 && existing[0].id !== id) {
		await db.execute("UPDATE climbs SET user_id = ? WHERE user_id = ?", [
			id,
			existing[0].id,
		]);
		await db.execute("DELETE FROM users WHERE id = ?", [existing[0].id]);
	}

	await db.execute(
		`INSERT INTO users (id, email, role)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email, role = excluded.role`,
		[id, email, role],
	);

	const rows = await db.select<User[]>("SELECT * FROM users WHERE id = ?", [
		id,
	]);
	return rows[0];
}

// ── Supabase user profile ────────────────────────────────────────────────────

export async function fetchOrCreateSupabaseUser(
	userId: string,
	email: string,
): Promise<"user" | "admin"> {
	// Check user_roles table for explicit role assignment
	const { data: roleData } = await supabase
		.from("user_roles")
		.select("role")
		.eq("user_id", userId)
		.single();

	if (roleData?.role === "admin") return "admin";

	// Ensure user row exists in Supabase
	const { data: userData } = await supabase
		.from("users")
		.select("id")
		.eq("id", userId)
		.single();

	if (!userData) {
		await supabase.from("users").insert({ id: userId, email, role: "user" });
	}

	return "user";
}
