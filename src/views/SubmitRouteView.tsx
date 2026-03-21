import { useForm } from "@tanstack/react-form";
import { useRouter, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { useAuthStore } from "@/features/auth/auth.store";
import { useGrades } from "@/features/grades/grades.queries";
import { useSubmitRoute } from "@/features/routes/routes.queries";
import { RouteSubmitSchema } from "@/features/routes/routes.schema";
import { useUiStore } from "@/stores/ui.store";

const SubmitRouteView = () => {
	const { wallId, wallName } = useSearch({ from: "/routes/submit" });
	const router = useRouter();
	const addToast = useUiStore((s) => s.addToast);
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");
	const { mutateAsync: submitRoute } = useSubmitRoute();

	const [routeType, setRouteType] = useState<"sport" | "boulder">("sport");
	const { data: grades = [] } = useGrades(routeType);

	const form = useForm({
		canSubmitWhenInvalid: true,
		defaultValues: {
			name: "",
			route_type: "sport" as "sport" | "boulder",
			grade: "",
			description: "",
		},
		onSubmit: async ({ value }) => {
			const grade = value.grade || (grades.length > 0 ? grades[0].grade : "");
			const parsed = RouteSubmitSchema.safeParse({
				wall_id: wallId,
				name: value.name,
				grade,
				route_type: value.route_type,
				description: value.description || undefined,
			});
			if (!parsed.success) {
				const messages = parsed.error.issues.map((i) => i.message).join("\n");
				addToast({ message: messages, type: "error" });
				return;
			}
			try {
				const newRouteId = await submitRoute(parsed.data);
				addToast({
					message: isAdmin ? "Route added" : "Route submitted for review",
					type: "success",
				});
				router.navigate({
					to: "/routes/$routeId",
					params: { routeId: newRouteId },
					replace: true,
				});
			} catch {
				addToast({ message: "Failed to submit route", type: "error" });
			}
		},
	});

	return (
		<div className="flex flex-col gap-4">
			<div className="rounded-lg bg-surface-card p-4">
				<p className="font-display font-semibold">Submit a route</p>
				<p className="text-sm text-text-secondary mt-1">Wall: {wallName}</p>
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
					name="name"
					validators={{
						onChange: ({ value }) =>
							value.trim() ? undefined : "Name is required",
					}}
				>
					{(field) => (
						<Input
							placeholder="Route name"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							errorState={field.state.meta.errors.length > 0}
						/>
					)}
				</form.Field>

				<form.Field name="route_type">
					{(field) => (
						<Select
							value={field.state.value}
							onChange={(e) => {
								const val = e.target.value as "sport" | "boulder";
								field.handleChange(val);
								setRouteType(val);
							}}
						>
							<option value="sport">Sport</option>
							<option value="boulder">Boulder</option>
						</Select>
					)}
				</form.Field>

				<form.Field name="grade">
					{(field) => (
						<Select
							value={
								field.state.value || (grades.length > 0 ? grades[0].grade : "")
							}
							onChange={(e) => field.handleChange(e.target.value)}
						>
							{grades.map((g) => (
								<option key={g.id} value={g.grade}>
									{g.grade}
								</option>
							))}
						</Select>
					)}
				</form.Field>

				<form.Field name="description">
					{(field) => (
						<textarea
							placeholder="Description (optional)"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							rows={3}
							className="rounded-[var(--radius-lg)] bg-surface-input p-2.5 font-medium outline-0 w-full border border-border-input focus:border-accent-primary transition-colors resize-none text-text-primary"
						/>
					)}
				</form.Field>

				<Button type="button" onClick={() => form.handleSubmit()}>
					Submit for review
				</Button>
			</form>
		</div>
	);
};

export default SubmitRouteView;
