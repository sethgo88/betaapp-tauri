import { useForm } from "@tanstack/react-form";
import { invoke } from "@tauri-apps/api/core";
import { FormInput } from "../../components/form/form-input";
import { FormSelect } from "../../components/form/form-select";
import PageWrapper from "../../components/page-wrapper/page-wrapper";
import type { ClimbType } from "../../types/climb";

export const AddContainer = ({ climbAsset }: { climbAsset?: ClimbType }) => {
	async function addClimb(climb: ClimbType) {
		return await invoke("add_climb", {
			climb: {
				name: "name2",
				route_type: "sport",
				grade: "5.11d",
				moves: "move1, move2",
				created_date: Date.now(),
				last_update_date: Date.now(),
				link: "link",
				route_location: "location",
				country: "usa",
				area: "aurea",
				sub_area: "subarea",
				sent_status: "Project",
			},
		});
	}

	const form = useForm({
		onSubmit: async ({ value }) => {
			addClimb(value);
		},
		defaultValues: {
			name: climbAsset?.name ?? "",
			type: climbAsset?.type ?? "sport",
			grade: climbAsset?.grade ?? "5.11d",
			country: climbAsset?.country ?? "",
			area: climbAsset?.area ?? "",
			subArea: climbAsset?.subArea ?? "",
			latlong: climbAsset?.latlong ?? "",
			link: climbAsset?.link ?? "",
			sent: climbAsset?.sent ?? false,
		} as ClimbType,
	});

	return (
		<PageWrapper>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				id="climb-form"
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
						<FormSelect name="routeGrade">
							<option value="5.11+">5.11+</option>
							<option value="5.11c/d">5.11c/d</option>
							<option value="5.11d">5.11d</option>
							<option value="5.12a">5.12a</option>
							<option value="5.12-">5.12-</option>
							<option value="5.12a/b">5.12a/b</option>
							<option value="5.12b">5.12b</option>
							<option value="5.12">5.12</option>
							<option value="5.12b/c">5.12b/c</option>
							<option value="5.12c">5.12c</option>
							<option value="5.12c/d">5.12c/d</option>
							<option value="5.12+">5.12+</option>
							<option value="5.12d">5.12d</option>
							<option value="5.13a">5.13a</option>
							<option value="5.13-">5.13-</option>
							<option value="5.13a/b">5.13a/b</option>
							<option value="5.13b">5.13b</option>
							<option value="5.13">5.13</option>
							<option value="5.13b/c">5.13b/c</option>
							<option value="5.13c">5.13c</option>
							<option value="5.13c/d">5.13c/d</option>
							<option value="5.13+">5.13+</option>
							<option value="5.13d">5.13d</option>
						</FormSelect>
						<FormSelect name="routeType">
							<option value="sport">Sport</option>
							<option value="boulder">Boulder</option>
						</FormSelect>
					</div>
					<FormInput type="text" placeholder="Link" name="routeLink" />
				</div>
			</form>
		</PageWrapper>
	);
};
