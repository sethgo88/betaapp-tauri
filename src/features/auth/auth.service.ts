import type { Session } from "@supabase/supabase-js";
import { getDb } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { User } from "./auth.schema";

// ── Magic link ──────────────────────────────────────────────────────────────

export async function signInWithMagicLink(email: string): Promise<void> {
	const { error } = await supabase.auth.signInWithOtp({
		email,
		options: { emailRedirectTo: "betaapp://auth/callback" },
	});
	if (error) throw error;
}

// ── Deep link callback ───────────────────────────────────────────────────────

export async function handleAuthCallback(url: string): Promise<Session | null> {
	// Hash fragment: betaapp://auth/callback#access_token=...&refresh_token=...
	const hash = url.split("#")[1];
	if (hash) {
		const params = new URLSearchParams(hash);
		const accessToken = params.get("access_token");
		const refreshToken = params.get("refresh_token");
		if (accessToken && refreshToken) {
			const { data, error } = await supabase.auth.setSession({
				access_token: accessToken,
				refresh_token: refreshToken,
			});
			if (error || !data.session) return null;
			return data.session;
		}
	}

	// Query param (PKCE code exchange): betaapp://auth/callback?code=...
	const query = url.split("?")[1]?.split("#")[0];
	if (query) {
		const params = new URLSearchParams(query);
		const code = params.get("code");
		if (code) {
			const { data, error } = await supabase.auth.exchangeCodeForSession(code);
			if (error || !data.session) return null;
			return data.session;
		}
	}

	return null;
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
	const { data } = await supabase
		.from("users")
		.select("role")
		.eq("id", userId)
		.single();

	if (data?.role) return data.role as "user" | "admin";

	// First login — create the user row in Supabase
	await supabase.from("users").insert({ id: userId, email, role: "user" });
	return "user";
}
