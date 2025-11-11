import { useForm, uuid } from "@tanstack/react-form";
import { invoke } from "@tauri-apps/api/core";
import { useContext, useEffect, useRef, useState } from "react";
import ToastContext from "@/components/toast/toast-context";
import { route_grades } from "@/lib/json";
import { FormInput } from "../../components/form/form-input";
import { FormSelect } from "../../components/form/form-select";
import PageWrapper from "../../components/page-wrapper/page-wrapper";
import type { ClimbType } from "../../types/climb";

type MoveType = {
	id: string;
	text: string;
};

export const AddContainer = ({ climbAsset }: { climbAsset?: ClimbType }) => {
	const [movesList, setMovesList] = useState<MoveType[]>(
		climbAsset?.moves
			? JSON.parse(climbAsset.moves)
			: [{ id: uuid(), text: "" }],
	);
	const [newClimb, setNewClimb] = useState(climbAsset ? false : true);
	const inputRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
	const { addToast } = useContext(ToastContext);

	const addMove = (id: string) => {
		const index = movesList.findIndex((x) => x.id === id);
		setMovesList([
			...movesList.slice(0, index + 1),
			{ id: uuid(), text: "" },
			...movesList.slice(index + 1),
		]);
	};

	const handleMoveChange = (
		e: React.ChangeEvent<HTMLTextAreaElement>,
		id: string,
	) => {
		const index = movesList.findIndex((x) => x.id === id);
		const item = movesList[index];
		item.text = e.target.value;
		setMovesList([
			...movesList.slice(0, index),
			item,
			...movesList.slice(index + 1),
		]);
	};

	const handleMoveDelete = (id: string) => {
		if (movesList.length > 1) {
			setMovesList([...movesList.filter((x) => x.id !== id)]);
		}
	};

	const handleTextAreaKeyDown = (
		e: React.KeyboardEvent<HTMLTextAreaElement>,
		id: string,
	) => {
		if (e.key === "Enter") {
			e.preventDefault();
			addMove(id);
		}
		if (e.key === "Backspace") {
			const target = e.currentTarget;
			if (target.value === "") {
				e.preventDefault();
				handleMoveDelete(id);
				const focusedIndex = getFocusedMoveIndex();
				inputRefs.current[focusedIndex - 1]?.focus();
			}
		}
	};

	const getFocusedMoveIndex = () => {
		const focused = inputRefs.current.find(
			(input) => input === document.activeElement,
		);
		if (!focused) return -1;
		return inputRefs.current.indexOf(focused);
	};

	useEffect(() => {
		if (inputRefs.current.length > 0 && movesList.length > 0) {
			const focused = inputRefs.current.find(
				(input) => input === document.activeElement,
			);
			if (!focused) return;
			const focusedIndex = inputRefs.current.indexOf(focused);
			inputRefs.current[focusedIndex + 1]?.focus();
		}
	}, [movesList.length]);

	async function addClimb(climb: ClimbType) {
		return await invoke("add_climb", {
			climb,
		});
	}

	async function editClimb(climb: ClimbType) {
		return await invoke("update_climb", {
			climb,
		});
	}

	const form = useForm({
		onSubmit: async ({ value }) => {
			const payload: ClimbType = {
				...value,
				id: climbAsset ? climbAsset.id : uuid(),
				created_date: climbAsset?.created_date || Date.now(),
				last_update_date: Date.now(),
				moves: JSON.stringify(movesList),
			};
			if (newClimb) {
				const response = await addClimb(payload);
				if (response) {
					addToast({
						message: "Climb Added",
						type: "success",
						id: crypto.randomUUID(),
					});
					setNewClimb(false);
				}
			} else {
				const response = await editClimb(payload);
				if (response) {
					addToast({
						message: "Climb Updated",
						type: "success",
						id: crypto.randomUUID(),
					});
				}
			}
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

	return (
		<PageWrapper className="grid pb-[calc(7vh+1rem)]">
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				id="climb-form"
				className="grid grid-rows-[auto_1fr] h-full gap-4"
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
					<div className="flex gap-2">
						<form.Field name="sent_status">
							{(field) => (
								<FormSelect
									onChange={(e) => {
										field.handleChange(e.target.value);
									}}
									value={field.state.value}
									name="sent_status"
								>
									<option value="Project">Project</option>
									<option value="Sent">Sent</option>
								</FormSelect>
							)}
						</form.Field>
					</div>
				</div>
				<div className="w-full rounded-md bg-stone-800 p-2 overflow-y-scroll">
					{movesList.map((move, index) => (
						<>
							<textarea
								onKeyDown={(e) =>
									handleTextAreaKeyDown(e, move.id ? move.id : "")
								}
								onChange={(e) =>
									handleMoveChange(e, move.id ? move.id : index.toString())
								}
								className="w-full field-sizing-content border-l border-white outline-none px-1"
								key={`move-input-${uuid}`}
								value={move.text}
								ref={(el) => {
									inputRefs.current[index] = el;
									return el;
								}}
							></textarea>
						</>
					))}
				</div>
			</form>
		</PageWrapper>
	);
};
