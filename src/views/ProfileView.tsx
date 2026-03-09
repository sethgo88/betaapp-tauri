import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { signInWithMagicLink, signOut } from "@/features/auth/auth.service";
import { useAuthStore } from "@/features/auth/auth.store";
import { useUiStore } from "@/stores/ui.store";

const EmailSchema = z.string().email("Valid email required");

const ProfileView = () => {
	const navigate = useNavigate();
	const { user, isAuthenticated, setUser, setSession } = useAuthStore();
	const addToast = useUiStore((s) => s.addToast);
	const [magicLinkSent, setMagicLinkSent] = useState(false);

	const form = useForm({
		defaultValues: { email: "" },
		onSubmit: async ({ value }) => {
			const parsed = EmailSchema.safeParse(value.email);
			if (!parsed.success) return;
			await signInWithMagicLink(parsed.data);
			setMagicLinkSent(true);
		},
	});

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
				</div>

				<Button variant="secondary" onClick={handleSignOut}>
					Sign out
				</Button>
			</div>
		);
	}

	if (magicLinkSent) {
		return (
			<div className="flex flex-col gap-4 pt-4">
				<div className="rounded-lg bg-stone-800 p-4">
					<p className="font-semibold mb-1">Check your email</p>
					<p className="text-sm text-stone-400">
						We sent a magic link to your email. Tap it on this device to sign
						in.
					</p>
				</div>
				<Button variant="secondary" onClick={() => setMagicLinkSent(false)}>
					Use a different email
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="rounded-lg bg-stone-800 p-4">
				<p className="font-semibold mb-1">Sign in</p>
				<p className="text-sm text-stone-400">
					Enter your email to receive a magic link.
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
						onChange: ({ value }) => {
							const result = EmailSchema.safeParse(value);
							return result.success ? undefined : "Valid email required";
						},
					}}
				>
					{(field) => (
						<Input
							type="email"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="your@email.com"
							errorState={field.state.meta.errors.length > 0}
						/>
					)}
				</form.Field>

				<Button type="submit">Send magic link</Button>
			</form>
		</div>
	);
};

export default ProfileView;
