import { useForm, uuid } from "@tanstack/react-form";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import {
	ClimbFormSchema,
	type ClimbFormValues,
	type RouteType,
} from "@/features/climbs/climbs.schema";
import { useGrades } from "@/features/grades/grades.queries";

type MoveItem = { id: string; text: string };

interface ClimbFormProps {
	defaultValues?: Partial<ClimbFormValues>;
	onSubmit: (values: ClimbFormValues) => Promise<void>;
}

export const ClimbForm = ({ defaultValues, onSubmit }: ClimbFormProps) => {
	const [movesList, setMovesList] = useState<MoveItem[]>(() => {
		if (defaultValues?.moves) {
			try {
				return JSON.parse(defaultValues.moves) as MoveItem[];
			} catch {
				return [{ id: uuid(), text: "" }];
			}
		}
		return [{ id: uuid(), text: "" }];
	});

	const [routeType, setRouteType] = useState<RouteType>(
		defaultValues?.route_type ?? "sport",
	);

	const inputRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

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
		setMovesList(
			movesList.map((m, i) =>
				i === index ? { ...m, text: e.target.value } : m,
			),
		);
	};

	const handleMoveDelete = (id: string) => {
		if (movesList.length > 1) {
			setMovesList(movesList.filter((x) => x.id !== id));
		}
	};

	const getFocusedMoveIndex = () => {
		const focused = inputRefs.current.find(
			(input) => input === document.activeElement,
		);
		if (!focused) return -1;
		return inputRefs.current.indexOf(focused);
	};

	const handleTextAreaKeyDown = (
		e: React.KeyboardEvent<HTMLTextAreaElement>,
		id: string,
	) => {
		if (e.key === "Enter") {
			e.preventDefault();
			addMove(id);
		}
		if (e.key === "Backspace" && e.currentTarget.value === "") {
			e.preventDefault();
			handleMoveDelete(id);
			const focusedIndex = getFocusedMoveIndex();
			inputRefs.current[focusedIndex - 1]?.focus();
		}
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

	const { data: grades = [] } = useGrades(routeType);

	const form = useForm({
		canSubmitWhenInvalid: true,
		defaultValues: {
			name: defaultValues?.name ?? "",
			route_type: defaultValues?.route_type ?? ("sport" as RouteType),
			grade: defaultValues?.grade ?? "",
			sent_status: defaultValues?.sent_status ?? "project",
			country: defaultValues?.country ?? "",
			area: defaultValues?.area ?? "",
			sub_area: defaultValues?.sub_area ?? "",
			route_location: defaultValues?.route_location ?? "",
			link: defaultValues?.link ?? "",
		},
		onSubmit: async ({ value }) => {
			const gradeValue =
				value.grade || (grades.length > 0 ? grades[0].grade : "");
			const parsed = ClimbFormSchema.safeParse({
				...value,
				grade: gradeValue,
				moves: JSON.stringify(movesList),
			});
			if (!parsed.success) {
				const messages = parsed.error.issues.map((i) => i.message).join(", ");
				alert(messages);
				return;
			}
			await onSubmit(parsed.data);
		},
	});

	return (
		<form
			id="climb-form"
			className="grid grid-rows-[auto_1fr] h-full gap-4"
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
			}}
		>
			<div className="flex flex-col gap-2">
				<form.Field
					name="name"
					validators={{
						onChange: ({ value }) => (!value ? "Name is required" : undefined),
					}}
				>
					{(field) => (
						<Input
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							placeholder="Name"
							errorState={field.state.meta.errors.length > 0}
						/>
					)}
				</form.Field>

				<div className="flex gap-2">
					<form.Field name="route_type">
						{(field) => (
							<Select
								value={field.state.value}
								onChange={(e) => {
									const val = e.target.value as RouteType;
									field.handleChange(val);
									setRouteType(val);
								}}
								name="route_type"
							>
								<option value="sport">Sport</option>
								<option value="boulder">Boulder</option>
							</Select>
						)}
					</form.Field>

					<div className="flex flex-col gap-1 flex-1">
						<label htmlFor="grade" className="text-xs text-stone-400">
							Personal grade
						</label>
						<form.Field name="grade">
							{(field) => (
								<Select
									id="grade"
									value={
										field.state.value ||
										(grades.length > 0 ? grades[0].grade : "")
									}
									onChange={(e) => field.handleChange(e.target.value)}
									name="grade"
								>
									{grades.map((g) => (
										<option key={g.id} value={g.grade}>
											{g.grade}
										</option>
									))}
								</Select>
							)}
						</form.Field>
					</div>
				</div>

				<div className="flex gap-2">
					<form.Field name="sent_status">
						{(field) => (
							<Select
								value={field.state.value}
								onChange={(e) =>
									field.handleChange(e.target.value as "project" | "sent")
								}
								name="sent_status"
							>
								<option value="project">Project</option>
								<option value="sent">Sent</option>
							</Select>
						)}
					</form.Field>
				</div>

				<form.Field name="link">
					{(field) => (
						<Input
							type="text"
							placeholder="Link (optional)"
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
						/>
					)}
				</form.Field>

				<Button
					type="submit"
					variant="primary"
					className="w-full"
					onClick={() => {
						form.handleSubmit();
					}}
				>
					Save
				</Button>
			</div>

			<div className="w-full rounded-md bg-stone-800 p-2 overflow-y-scroll">
				{movesList.map((move, index) => (
					<textarea
						key={move.id}
						onKeyDown={(e) => handleTextAreaKeyDown(e, move.id)}
						onChange={(e) => handleMoveChange(e, move.id)}
						className="w-full field-sizing-content border-l border-white outline-none px-1 bg-transparent"
						value={move.text}
						ref={(el) => {
							inputRefs.current[index] = el;
						}}
					/>
				))}
			</div>
		</form>
	);
};
