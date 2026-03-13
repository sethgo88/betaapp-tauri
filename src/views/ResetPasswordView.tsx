import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { updatePassword } from "@/features/auth/auth.service";
import { useUiStore } from "@/stores/ui.store";

const PASSWORD_MIN_LENGTH = 6;

const PasswordSchema = z
	.string()
	.min(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters`);

const ResetPasswordView = () => {
	const navigate = useNavigate();
	const addToast = useUiStore((s) => s.addToast);

	const form = useForm({
		defaultValues: { password: "", confirmPassword: "" },
		onSubmit: async ({ value }) => {
			if (value.password !== value.confirmPassword) {
				addToast({ message: "Passwords don't match", type: "error" });
				return;
			}
			try {
				await updatePassword(value.password);
				addToast({ message: "Password updated", type: "success" });
				navigate({ to: "/profile" });
			} catch (err) {
				addToast({
					message:
						err instanceof Error ? err.message : "Failed to update password",
					type: "error",
				});
			}
		},
	});

	return (
		<div className="flex flex-col gap-4">
			<div className="rounded-lg bg-surface-card p-4">
				<p className="font-semibold mb-1">Reset password</p>
				<p className="text-sm text-text-secondary">
					Choose a new password (at least {PASSWORD_MIN_LENGTH} characters).
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
							placeholder="New password"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							errorState={field.state.meta.errors.length > 0}
						/>
					)}
				</form.Field>

				<form.Field name="confirmPassword">
					{(field) => (
						<Input
							type="password"
							placeholder="Confirm new password"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							errorState={field.state.meta.errors.length > 0}
						/>
					)}
				</form.Field>

				<Button type="submit">Update password</Button>
			</form>
		</div>
	);
};

export default ResetPasswordView;
