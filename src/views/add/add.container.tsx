import { useForm } from "@tanstack/react-form";
import { invoke } from "@tauri-apps/api/core";
import { route_grades } from "@/lib/json";
import { FormInput } from "../../components/form/form-input";
import { FormSelect } from "../../components/form/form-select";
import PageWrapper from "../../components/page-wrapper/page-wrapper";
import type { ClimbType } from "../../types/climb";

export const AddContainer = ({ climbAsset }: { climbAsset?: ClimbType }) => {
	async function addClimb(climb: Omit<ClimbType, "id">) {
		return await invoke("add_climb", {
			climb,
		});
	}

	const form = useForm({
		onSubmit: async ({ value }) => {
			const payload: Omit<ClimbType, "id"> = {
				...value,
				created_date: climbAsset?.created_date || Date.now(),
				last_update_date: Date.now(),
				sent_status: "Project",
				moves: "",
			};
			alert(JSON.stringify(payload, null, 2));
			addClimb(payload);
		},
		defaultValues: {
			name: climbAsset?.name ?? "",
			route_type: climbAsset?.route_type ?? "sport",
			grade: climbAsset?.grade ?? "5.11d",
			country: climbAsset?.country ?? "",
			area: climbAsset?.area ?? "",
			sub_area: climbAsset?.sub_area ?? "",
			route_location: climbAsset?.route_location ?? "",
			link: climbAsset?.link ?? "",
			sent_status: climbAsset?.sent_status ?? "Project",
		},
	});

	const handleTextAreaKeyDown = (
		e: React.KeyboardEvent<HTMLTextAreaElement>,
	) => {
		if (e.key === "Enter") {
			e.preventDefault();
			console.log("Enter pressed in textarea");
		}
	};

	return (
		<PageWrapper>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				id="climb-form"
				className="flex flex-col gap-4"
			>
				<div className="flex flex-col gap-2">
					<form.Field
						name="name"
						validators={{
							onChange: ({ value }) => (!value ? "Name is required" : null),
						}}
					>
						{(field) => (
							<FormInput
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								placeholder="name"
								errorState={field.state.meta.errors.length > 0}
							/>
						)}
					</form.Field>
					<div className="flex gap-2">
						<form.Subscribe selector={(state) => state.values.route_type}>
							{(type) => (
								<form.Field
									name="grade"
									validators={{
										onChange: ({ value }) =>
											!value ? "Grade is required" : null,
									}}
								>
									{(field) => (
										<>
											<FormSelect
												name="grade"
												onChange={(e) => field.handleChange(e.target.value)}
												value={field.state.value}
											>
												{type === "sport"
													? route_grades.sport.map((type) => (
															<option key={type} value={type}>
																{type}
															</option>
														))
													: route_grades.boulder.map((type) => (
															<option key={type} value={type}>
																{type}
															</option>
														))}
											</FormSelect>
										</>
									)}
								</form.Field>
							)}
						</form.Subscribe>

						<form.Field
							name="route_type"
							validators={{
								onChange: ({ value }) => (!value ? "Type is required" : null),
							}}
						>
							{(field) => (
								<FormSelect
									onChange={(e) => {
										field.handleChange(e.target.value);
									}}
									value={field.state.value}
									name="route_type"
								>
									<option value="sport">Sport</option>
									<option value="boulder">Boulder</option>
								</FormSelect>
							)}
						</form.Field>
					</div>
					<FormInput type="text" placeholder="Link" name="link" />
				</div>
				<div className="w-full rounded-md bg-stone-800 p-2 h-[calc(93vh-240px)]">
					<textarea
						onKeyDown={(e) => handleTextAreaKeyDown(e)}
						className="w-full field-sizing-content border-l border-white outline-none px-1"
					></textarea>
				</div>
			</form>
		</PageWrapper>
	);
};
