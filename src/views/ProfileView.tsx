import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { insertUser, updateUserEmail } from "@/features/auth/auth.service";
import { useAuthStore } from "@/features/auth/auth.store";
import { useUiStore } from "@/stores/ui.store";

const EmailSchema = z.object({
	email: z.string().email("Valid email required"),
});

const ProfileView = () => {
	const navigate = useNavigate();
	const { user, setUser } = useAuthStore();
	const addToast = useUiStore((s) => s.addToast);

	const form = useForm({
		defaultValues: { email: user?.email ?? "" },
		onSubmit: async ({ value }) => {
			const parsed = EmailSchema.safeParse(value);
			if (!parsed.success) return;

			if (!user) {
				const newUser = await insertUser(parsed.data.email);
				setUser(newUser);
				addToast({ message: "Profile created", type: "success" });
				navigate({ to: "/" });
			} else {
				await updateUserEmail(user.id, parsed.data.email);
				setUser({ ...user, email: parsed.data.email });
				addToast({ message: "Profile updated", type: "success" });
			}
		},
	});

	return (
		<div className="flex flex-col gap-4">
			{user && (
				<div className="rounded-lg bg-stone-800 p-3">
					<p className="text-xs text-stone-400">Signed in as</p>
					<p className="font-semibold">{user.email}</p>
				</div>
			)}

			<form
				id="profile-form"
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
							const result = z.string().email().safeParse(value);
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
							placeholder="Email"
							errorState={field.state.meta.errors.length > 0}
						/>
					)}
				</form.Field>

				<Button type="submit">{user ? "Update" : "Save"} Profile</Button>
			</form>
		</div>
	);
};

export default ProfileView;
