import type { Session } from "@supabase/supabase-js";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { ToggleGroup } from "@/components/atoms/ToggleGroup";
import { SyncStatus } from "@/components/molecules/SyncStatus";
import type { UnitPreference } from "@/features/auth/auth.schema";
import {
	fetchAndApplyProfile,
	fetchOrCreateSupabaseUser,
	sendMagicLink,
	sendPasswordReset,
	signIn,
	signOut,
	signUp,
	type UserProfileUpdate,
	updateUserProfile,
	upsertLocalUser,
} from "@/features/auth/auth.service";
import { useAuthStore } from "@/features/auth/auth.store";
import { useGrades } from "@/features/grades/grades.queries";
import { useSyncStore } from "@/features/sync/sync.store";
import { cmToFtIn, cmToIn, ftInToCm, inToCm } from "@/lib/units";
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
		<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-2">
			<p className="text-xs text-text-on-light uppercase tracking-wide">
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

const MagicLinkForm = ({
	onSent,
	onBack,
	onError,
}: {
	onSent: () => void;
	onBack: () => void;
	onError: () => void;
}) => {
	const form = useForm({
		defaultValues: { email: "" },
		onSubmit: async ({ value }) => {
			try {
				await sendMagicLink(value.email);
				onSent();
			} catch {
				onError();
			}
		},
	});

	return (
		<div className="flex flex-col gap-4">
			<div className="rounded-lg bg-surface-card p-4">
				<p className="font-semibold mb-1">Magic link</p>
				<p className="text-sm text-text-on-light">
					We'll send a sign-in link to your email.
				</p>
			</div>

			<form
				className="flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field
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
				</form.Field>

				<Button type="submit">Send magic link</Button>
			</form>

			<button
				type="button"
				className="text-sm text-white text-center"
				onClick={onBack}
			>
				Back to sign in
			</button>
		</div>
	);
};

const ForgotPasswordForm = ({
	onSent,
	onBack,
	onError,
}: {
	onSent: () => void;
	onBack: () => void;
	onError: () => void;
}) => {
	const form = useForm({
		defaultValues: { email: "" },
		onSubmit: async ({ value }) => {
			try {
				await sendPasswordReset(value.email);
				onSent();
			} catch {
				onError();
			}
		},
	});

	return (
		<div className="flex flex-col gap-4">
			<div className="rounded-lg bg-surface-card p-4">
				<p className="font-semibold mb-1">Forgot password</p>
				<p className="text-sm text-text-on-light">
					Enter your email and we'll send a reset link.
				</p>
			</div>

			<form
				className="flex flex-col gap-3"
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field
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
				</form.Field>

				<Button type="submit">Send reset link</Button>
			</form>

			<button
				type="button"
				className="text-sm text-white text-center"
				onClick={onBack}
			>
				Back to sign in
			</button>
		</div>
	);
};

const AuthenticatedProfile = ({
	user,
	onSignOut,
	onUserUpdate,
}: {
	user: NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>;
	onSignOut: () => void;
	onUserUpdate: (
		user: NonNullable<ReturnType<typeof useAuthStore.getState>["user"]>,
	) => void;
}) => {
	const addToast = useUiStore((s) => s.addToast);
	const defaultStatusFilters = useUiStore((s) => s.defaultStatusFilters);
	const setDefaultStatusFilters = useUiStore((s) => s.setDefaultStatusFilters);

	const toggleDefaultStatus = (status: string) => {
		const next = new Set(defaultStatusFilters);
		if (next.has(status)) next.delete(status);
		else next.add(status);
		setDefaultStatusFilters(next);
	};
	const unit = user.default_unit ?? "imperial";
	const { data: sportGrades = [] } = useGrades("sport");
	const { data: boulderGrades = [] } = useGrades("boulder");

	const [displayName, setDisplayName] = useState(user.display_name ?? "");
	const [defaultUnit, setDefaultUnit] = useState<UnitPreference>(unit);
	const [heightFt, setHeightFt] = useState(() => {
		if (user.height_cm == null) return "";
		return unit === "imperial" ? String(cmToFtIn(user.height_cm).ft) : "";
	});
	const [heightIn, setHeightIn] = useState(() => {
		if (user.height_cm == null) return "";
		return unit === "imperial" ? String(cmToFtIn(user.height_cm).inches) : "";
	});
	const [heightCmVal, setHeightCmVal] = useState(() => {
		if (user.height_cm == null) return "";
		return unit === "metric" ? String(user.height_cm) : "";
	});
	const [apeVal, setApeVal] = useState(() => {
		if (user.ape_index_cm == null) return "";
		return unit === "imperial"
			? String(cmToIn(user.ape_index_cm))
			: String(user.ape_index_cm);
	});
	const [maxSport, setMaxSport] = useState(user.max_redpoint_sport ?? "");
	const [maxBoulder, setMaxBoulder] = useState(user.max_redpoint_boulder ?? "");

	const handleUnitToggle = (newUnit: UnitPreference) => {
		if (newUnit === defaultUnit) return;
		// Convert height
		if (newUnit === "metric") {
			if (heightFt !== "" || heightIn !== "") {
				const cm = ftInToCm(Number(heightFt) || 0, Number(heightIn) || 0);
				setHeightCmVal(String(cm));
			}
			setHeightFt("");
			setHeightIn("");
		} else {
			if (heightCmVal !== "") {
				const { ft, inches } = cmToFtIn(Number(heightCmVal));
				setHeightFt(String(ft));
				setHeightIn(String(inches));
			}
			setHeightCmVal("");
		}
		// Convert ape index
		if (apeVal !== "") {
			const cm =
				defaultUnit === "imperial" ? inToCm(Number(apeVal)) : Number(apeVal);
			setApeVal(newUnit === "imperial" ? String(cmToIn(cm)) : String(cm));
		}
		setDefaultUnit(newUnit);
	};

	const [saveError, setSaveError] = useState<string | null>(null);

	const handleSave = async () => {
		setSaveError(null);
		const trimmedName = displayName.trim();

		if (trimmedName.length > 50) {
			setSaveError("Display name must be 50 characters or fewer");
			return;
		}

		const heightCm =
			defaultUnit === "imperial"
				? heightFt !== "" || heightIn !== ""
					? ftInToCm(Number(heightFt) || 0, Number(heightIn) || 0)
					: null
				: heightCmVal !== ""
					? Number(heightCmVal)
					: null;

		if (heightCm !== null && (heightCm <= 0 || !Number.isInteger(heightCm))) {
			setSaveError("Height must be a positive whole number");
			return;
		}

		const apeCm =
			apeVal !== ""
				? defaultUnit === "imperial"
					? inToCm(Number(apeVal))
					: Number(apeVal)
				: null;

		if (apeCm !== null && !Number.isFinite(apeCm)) {
			setSaveError("Ape index must be a valid number");
			return;
		}

		const profile: UserProfileUpdate = {
			display_name: trimmedName || null,
			height_cm: heightCm,
			ape_index_cm: apeCm,
			max_redpoint_sport: maxSport || null,
			max_redpoint_boulder: maxBoulder || null,
			default_unit: defaultUnit,
		};

		try {
			const updated = await updateUserProfile(user.id, profile);
			onUserUpdate(updated);
			addToast({ message: "Profile saved", type: "success" });
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to save profile";
			setSaveError(msg);
			addToast({ message: msg, type: "error" });
		}
	};

	return (
		<div className="flex flex-col gap-4">
			{/* Account */}
			<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-2">
				<p className="text-xs text-text-on-light uppercase tracking-wide">
					Account
				</p>
				<p className="font-semibold">
					{user.display_name ? `${user.display_name} — ` : ""}
					{user.email}
				</p>
				{user.role === "admin" && (
					<span className="self-start bg-accent-primary text-white text-xs rounded-full px-2 py-0.5">
						Admin
					</span>
				)}
				<Button variant="secondary" onClick={onSignOut}>
					Sign out
				</Button>
			</div>

			{/* Settings */}
			<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-3">
				<p className="text-xs text-text-on-light uppercase tracking-wide">
					Settings
				</p>
				<div>
					<p className="text-sm mb-1">Units</p>
					<ToggleGroup
						options={[
							{ value: "imperial", label: "Imperial" },
							{ value: "metric", label: "Metric" },
						]}
						value={defaultUnit}
						onChange={(v) => handleUnitToggle(v as UnitPreference)}
					/>
				</div>
				<div>
					<p className="text-sm mb-1">Home screen</p>
					<div className="flex flex-wrap gap-x-4 gap-y-1">
						{(["sent", "project", "todo"] as const).map((status) => (
							<label
								key={status}
								className="flex items-center gap-2 text-sm cursor-pointer capitalize"
							>
								<input
									type="checkbox"
									checked={defaultStatusFilters.has(status)}
									onChange={() => toggleDefaultStatus(status)}
									className="accent-accent-primary w-4 h-4"
								/>
								{status}
							</label>
						))}
					</div>
				</div>
			</div>

			{/* Profile */}
			<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-3">
				<p className="text-xs text-text-on-light uppercase tracking-wide">
					Profile
				</p>
				<Input
					placeholder="Display name"
					value={displayName}
					onChange={(e) => setDisplayName(e.target.value)}
				/>
				<div>
					<p className="text-xs text-text-on-light mb-1">Height</p>
					{defaultUnit === "imperial" ? (
						<div className="flex gap-2">
							<Input
								type="number"
								placeholder="ft"
								value={heightFt}
								onChange={(e) => setHeightFt(e.target.value)}
							/>
							<Input
								type="number"
								placeholder="in"
								value={heightIn}
								onChange={(e) => setHeightIn(e.target.value)}
							/>
						</div>
					) : (
						<Input
							type="number"
							placeholder="cm"
							value={heightCmVal}
							onChange={(e) => setHeightCmVal(e.target.value)}
						/>
					)}
				</div>
				<div>
					<p className="text-xs text-text-on-light mb-1">Ape index</p>
					<Input
						type="number"
						placeholder={defaultUnit === "imperial" ? "in" : "cm"}
						value={apeVal}
						onChange={(e) => setApeVal(e.target.value)}
					/>
				</div>
				<div className="flex gap-2">
					<div className="flex-1">
						<p className="text-xs text-text-on-light mb-1">
							Max redpoint (sport)
						</p>
						<Select
							value={maxSport}
							onChange={(e) => setMaxSport(e.target.value)}
						>
							<option value="">—</option>
							{sportGrades.map((g) => (
								<option key={g.id} value={g.grade}>
									{g.grade}
								</option>
							))}
						</Select>
					</div>
					<div className="flex-1">
						<p className="text-xs text-text-on-light mb-1">
							Max redpoint (boulder)
						</p>
						<Select
							value={maxBoulder}
							onChange={(e) => setMaxBoulder(e.target.value)}
						>
							<option value="">—</option>
							{boulderGrades.map((g) => (
								<option key={g.id} value={g.grade}>
									{g.grade}
								</option>
							))}
						</Select>
					</div>
				</div>
				{saveError && <p className="text-sm text-red-400">{saveError}</p>}
				<Button onClick={handleSave}>Save</Button>
			</div>

			<SyncStatusWell />
		</div>
	);
};

const ProfileView = () => {
	const navigate = useNavigate();
	const { user, isAuthenticated, setUser, setSession } = useAuthStore();
	const addToast = useUiStore((s) => s.addToast);
	const [mode, setMode] = useState<"signin" | "signup" | "magic" | "forgot">(
		"signin",
	);
	const [magicSent, setMagicSent] = useState(false);
	const [resetSent, setResetSent] = useState(false);

	const handleSession = async (session: Session) => {
		setSession(session);
		const role = await fetchOrCreateSupabaseUser(
			session.user.id,
			session.user.email ?? "",
		);
		await upsertLocalUser(session.user.id, session.user.email ?? "", role);
		const localUser = await fetchAndApplyProfile(session.user.id);
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
			<AuthenticatedProfile
				user={user}
				onSignOut={handleSignOut}
				onUserUpdate={(u) => setUser(u)}
			/>
		);
	}

	if (mode === "signup") {
		return (
			<div className="flex flex-col gap-4">
				<div className="rounded-lg bg-surface-card p-4">
					<p className="font-semibold mb-1">Create account</p>
					<p className="text-sm text-text-on-light">
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
					className="text-sm text-white text-center"
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

	if (mode === "forgot") {
		if (resetSent) {
			return (
				<div className="flex flex-col gap-4">
					<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-2">
						<p className="font-semibold">Check your email</p>
						<p className="text-sm text-text-on-light">
							A password reset link has been sent. Tap it to open the app and
							set a new password.
						</p>
					</div>
					<button
						type="button"
						className="text-sm text-white text-center"
						onClick={() => setMode("signin")}
					>
						Back to sign in
					</button>
				</div>
			);
		}

		return (
			<ForgotPasswordForm
				onSent={() => setResetSent(true)}
				onBack={() => setMode("signin")}
				onError={() =>
					addToast({
						message: "Failed to send reset email",
						type: "error",
					})
				}
			/>
		);
	}

	if (mode === "magic") {
		if (magicSent) {
			return (
				<div className="flex flex-col gap-4">
					<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-2">
						<p className="font-semibold">Check your email</p>
						<p className="text-sm text-text-on-light">
							A sign-in link has been sent. Tap it to open the app and sign in
							automatically.
						</p>
					</div>
					<button
						type="button"
						className="text-sm text-white text-center"
						onClick={() => setMode("signin")}
					>
						Back to sign in
					</button>
				</div>
			);
		}

		return (
			<MagicLinkForm
				onSent={() => setMagicSent(true)}
				onBack={() => setMode("signin")}
				onError={() =>
					addToast({ message: "Failed to send magic link", type: "error" })
				}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="rounded-lg bg-surface-card p-4">
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
				className="text-sm text-white text-center"
				onClick={() => {
					setMode("forgot");
					setResetSent(false);
				}}
			>
				Forgot password?
			</button>

			<button
				type="button"
				className="text-sm text-white text-center"
				onClick={() => setMode("signup")}
			>
				No account? Create one
			</button>

			<button
				type="button"
				className="text-sm text-white text-center"
				onClick={() => {
					setMode("magic");
					setMagicSent(false);
				}}
			>
				Sign in with magic link
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
