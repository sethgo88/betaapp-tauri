import type { Session } from "@supabase/supabase-js";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { SyncStatus } from "@/components/molecules/SyncStatus";
import {
	fetchOrCreateSupabaseUser,
	signIn,
	signOut,
	signUp,
	upsertLocalUser,
} from "@/features/auth/auth.service";
import { useAuthStore } from "@/features/auth/auth.store";
import { useSyncStore } from "@/features/sync/sync.store";
import { useUiStore } from "@/stores/ui.store";

// ── Password policy — change this to update requirements everywhere ───────────
const PASSWORD_MIN_LENGTH = 6;

const SYNC_LABEL: Record<string, string> = {
	idle: "Synced",
	syncing: "Syncing…",
	error: "No internet",
};

const SyncStatusWell = () => {
	const status = useSyncStore((s) => s.status);
	const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
	const label =
		lastSyncedAt || status !== "idle" ? SYNC_LABEL[status] : "Not yet synced";

	return (
		<div className="rounded-lg bg-stone-800 p-4 flex flex-col gap-2">
			<p className="text-xs text-stone-400 uppercase tracking-wide">
				Sync Status
			</p>
			<div className="flex items-center gap-2">
				<SyncStatus />
				<span className="text-sm">{label}</span>
			</div>
		</div>
	);
};

const EmailSchema = z.string().email("Valid email required");
const PasswordSchema = z
	.string()
	.min(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters`);

const DEV_ID = "00000000-0000-0000-0000-000000000001";
const DEV_EMAIL = "dev@betaapp.local";

const ProfileView = () => {
	const navigate = useNavigate();
	const { user, isAuthenticated, setUser, setSession } = useAuthStore();
	const addToast = useUiStore((s) => s.addToast);
	const [mode, setMode] = useState<"signin" | "signup">("signin");

	const handleSession = async (session: Session) => {
		setSession(session);
		const role = await fetchOrCreateSupabaseUser(
			session.user.id,
			session.user.email ?? "",
		);
		const localUser = await upsertLocalUser(
			session.user.id,
			session.user.email ?? "",
			role,
		);
		setUser(localUser);
		navigate({ to: "/" });
	};

	const signInForm = useForm({
		defaultValues: { email: "", password: "" },
		onSubmit: async ({ value }) => {
			try {
				const session = await signIn(value.email, value.password);
				await handleSession(session);
			} catch (err) {
				console.error("Sign in error:", err);
				addToast({ message: "Invalid email or password", type: "error" });
			}
		},
	});

	const signUpForm = useForm({
		defaultValues: { email: "", password: "", confirmPassword: "" },
		onSubmit: async ({ value }) => {
			if (value.password !== value.confirmPassword) {
				addToast({ message: "Passwords don't match", type: "error" });
				return;
			}
			try {
				const session = await signUp(value.email, value.password);
				await handleSession(session);
			} catch (err) {
				console.error("Sign up error:", err);
				addToast({
					message: err instanceof Error ? err.message : "Sign up failed",
					type: "error",
				});
			}
		},
	});

	const handleDevLogin = async () => {
		const devUser = await upsertLocalUser(DEV_ID, DEV_EMAIL, "admin");
		setUser(devUser);
		setSession({ user: { id: DEV_ID } } as Session);
		navigate({ to: "/" });
	};

	const handleSignOut = async () => {
		await signOut();
		setSession(null);
		setUser(null);
		navigate({ to: "/" });
		addToast({ message: "Signed out", type: "success" });
	};

	if (isAuthenticated && user) {
		return (
			<div className="flex flex-col gap-4">
				<div className="rounded-lg bg-stone-800 p-4 flex flex-col gap-2">
					<p className="text-xs text-stone-400 uppercase tracking-wide">
						Signed in as
					</p>
					<p className="font-semibold">{user.email}</p>
					{user.role === "admin" && (
						<span className="self-start bg-emerald-700 text-xs rounded-full px-2 py-0.5">
							Admin
						</span>
					)}
					<Button variant="secondary" onClick={handleSignOut}>
						Sign out
					</Button>
				</div>
				<SyncStatusWell />
			</div>
		);
	}

	if (mode === "signup") {
		return (
			<div className="flex flex-col gap-4">
				<div className="rounded-lg bg-stone-800 p-4">
					<p className="font-semibold mb-1">Create account</p>
					<p className="text-sm text-stone-400">
						Password must be at least {PASSWORD_MIN_LENGTH} characters.
					</p>
				</div>

				<form
					className="flex flex-col gap-3"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						signUpForm.handleSubmit();
					}}
				>
					<signUpForm.Field
						name="email"
						validators={{
							onChange: ({ value }) =>
								EmailSchema.safeParse(value).success
									? undefined
									: "Valid email required",
						}}
					>
						{(field) => (
							<Input
								type="email"
								placeholder="your@email.com"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								errorState={field.state.meta.errors.length > 0}
							/>
						)}
					</signUpForm.Field>

					<signUpForm.Field
						name="password"
						validators={{
							onChange: ({ value }) =>
								PasswordSchema.safeParse(value).success
									? undefined
									: `At least ${PASSWORD_MIN_LENGTH} characters`,
						}}
					>
						{(field) => (
							<Input
								type="password"
								placeholder="Password"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								errorState={field.state.meta.errors.length > 0}
							/>
						)}
					</signUpForm.Field>

					<signUpForm.Field name="confirmPassword">
						{(field) => (
							<Input
								type="password"
								placeholder="Confirm password"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								errorState={field.state.meta.errors.length > 0}
							/>
						)}
					</signUpForm.Field>

					<Button type="submit">Create account</Button>
				</form>

				<button
					type="button"
					className="text-sm text-stone-400 text-center"
					onClick={() => setMode("signin")}
				>
					Already have an account? Sign in
				</button>

				{import.meta.env.DEV && (
					<Button variant="secondary" onClick={handleDevLogin}>
						Dev login
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="rounded-lg bg-stone-800 p-4">
				<p className="font-semibold mb-1">Sign in</p>
			</div>

			<form
				className="flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					signInForm.handleSubmit();
				}}
			>
				<signInForm.Field
					name="email"
					validators={{
						onChange: ({ value }) =>
							EmailSchema.safeParse(value).success
								? undefined
								: "Valid email required",
					}}
				>
					{(field) => (
						<Input
							type="email"
							placeholder="your@email.com"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							errorState={field.state.meta.errors.length > 0}
						/>
					)}
				</signInForm.Field>

				<signInForm.Field
					name="password"
					validators={{
						onChange: ({ value }) =>
							PasswordSchema.safeParse(value).success
								? undefined
								: `At least ${PASSWORD_MIN_LENGTH} characters`,
					}}
				>
					{(field) => (
						<Input
							type="password"
							placeholder="Password"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							errorState={field.state.meta.errors.length > 0}
						/>
					)}
				</signInForm.Field>

				<Button type="submit">Sign in</Button>
			</form>

			<button
				type="button"
				className="text-sm text-stone-400 text-center"
				onClick={() => setMode("signup")}
			>
				No account? Create one
			</button>

			{import.meta.env.DEV && (
				<Button variant="secondary" onClick={handleDevLogin}>
					Dev login
				</Button>
			)}
		</div>
	);
};

export default ProfileView;
