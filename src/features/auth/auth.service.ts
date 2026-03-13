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

// ── Password reset ──────────────────────────────────────────────────────────

export async function sendPasswordReset(email: string): Promise<void> {
	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: "betaapp://auth/callback",
	});
	if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
	const { error } = await supabase.auth.updateUser({ password: newPassword });
	if (error) throw error;
}

// ── Magic link ───────────────────────────────────────────────────────────────

export async function sendMagicLink(email: string): Promise<void> {
	const { error } = await supabase.auth.signInWithOtp({
		email,
		options: { emailRedirectTo: "betaapp://auth/callback" },
	});
	if (error) throw error;
}

// ── Deep link handler ────────────────────────────────────────────────────────

async function handleDeepLinkUrl(
	url: string,
	onSession: (session: Session) => void,
): Promise<void> {
	console.log("[deep-link] processing:", url);
	if (!url.startsWith("betaapp://auth/callback")) return;

	const parsed = new URL(url.replace("betaapp://", "https://placeholder/"));

	// PKCE flow: code in query string
	const code = parsed.searchParams.get("code");
	if (code) {
		console.log("[deep-link] exchanging PKCE code");
		const { data, error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error && data.session) {
			onSession(data.session);
		} else {
			console.error("[deep-link] code exchange failed:", error);
		}
		return;
	}

	// Implicit flow: tokens in hash fragment
	const fragment = parsed.hash?.substring(1);
	if (fragment) {
		const hashParams = new URLSearchParams(fragment);
		const accessToken = hashParams.get("access_token");
		const refreshToken = hashParams.get("refresh_token");
		if (accessToken && refreshToken) {
			console.log("[deep-link] setting session from hash tokens");
			const { data, error } = await supabase.auth.setSession({
				access_token: accessToken,
				refresh_token: refreshToken,
			});
			if (!error && data.session) {
				onSession(data.session);
			} else {
				console.error("[deep-link] setSession failed:", error);
			}
			return;
		}
	}

	console.warn("[deep-link] no code or tokens found in URL:", url);
}

export async function checkPendingDeepLink(
	onSession: (session: Session) => void,
): Promise<void> {
	try {
		const { getCurrent } = await import("@tauri-apps/plugin-deep-link");
		const urls = await getCurrent();
		console.log("[deep-link] getCurrent:", urls);
		if (urls) {
			for (const url of urls) {
				await handleDeepLinkUrl(url, onSession);
			}
		}
	} catch (err) {
		console.error("[deep-link] getCurrent failed:", err);
	}
}

export async function initDeepLinkHandler(
	onSession: (session: Session) => void,
): Promise<() => void> {
	const { onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
	const unlisten = await onOpenUrl(async (urls) => {
		for (const url of urls) {
			await handleDeepLinkUrl(url, onSession);
		}
	});
	return unlisten;
}

// ── Supabase user profile ────────────────────────────────────────────────────

export async function fetchOrCreateSupabaseUser(
	userId: string,
	_email: string,
): Promise<"user" | "admin"> {
	// Role is managed exclusively via user_roles table
	const { data: roleData } = await supabase
		.from("user_roles")
		.select("role")
		.eq("user_id", userId)
		.single();

	return roleData?.role === "admin" ? "admin" : "user";
}
