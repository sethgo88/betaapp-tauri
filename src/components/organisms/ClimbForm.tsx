import type { DragEndEvent } from "@dnd-kit/core";
import {
	closestCenter,
	DndContext,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useForm, uuid } from "@tanstack/react-form";
import { useBlocker } from "@tanstack/react-router";
import { GripVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { ToggleGroup } from "@/components/atoms/ToggleGroup";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { ImportBetaSheet } from "@/components/molecules/ImportBetaSheet";
import { useUpdateClimbMoves } from "@/features/climbs/climbs.queries";
import {
	ClimbFormSchema,
	type ClimbFormValues,
	type RouteType,
	type SentStatus,
} from "@/features/climbs/climbs.schema";
import { useGrades } from "@/features/grades/grades.queries";

type MoveItem = { id: string; text: string };

// ── Sortable move row ─────────────────────────────────────────────────────────

interface SortableMoveRowProps {
	move: MoveItem;
	index: number;
	onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) => void;
	onChange: (e: React.ChangeEvent<HTMLTextAreaElement>, id: string) => void;
	setRef: (el: HTMLTextAreaElement | null, index: number) => void;
	onFocus: (index: number) => void;
}

const SortableMoveRow = ({
	move,
	index,
	onKeyDown,
	onChange,
	setRef,
	onFocus,
}: SortableMoveRowProps) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: move.id });

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.4 : 1,
		touchAction: "none",
	};

	return (
		<div ref={setNodeRef} style={style} className="flex items-start gap-1">
			{/* Drag handle — long press to activate */}
			<button
				type="button"
				className="flex-shrink-0 mt-1 p-1 text-text-tertiary touch-none cursor-grab active:cursor-grabbing"
				aria-label="Drag to reorder"
				{...attributes}
				{...listeners}
			>
				<GripVertical size={16} />
			</button>
			<textarea
				onKeyDown={(e) => onKeyDown(e, move.id)}
				onChange={(e) => onChange(e, move.id)}
				onFocus={() => onFocus(index)}
				className="flex-1 field-sizing-content border-l border-text-primary outline-none px-1 bg-transparent"
				value={move.text}
				ref={(el) => setRef(el, index)}
			/>
		</div>
	);
};

// ── Climb form ────────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved";

interface ClimbFormProps {
	defaultValues?: Partial<ClimbFormValues>;
	onSubmit: (values: ClimbFormValues) => Promise<void>;
	/** When provided, moves are auto-saved after a 1-second debounce. */
	climbId?: string;
}

export const ClimbForm = ({
	defaultValues,
	onSubmit,
	climbId,
}: ClimbFormProps) => {
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

	const [routeType, _setRouteType] = useState<RouteType>(
		defaultValues?.route_type ?? "sport",
	);
	const [importOpen, setImportOpen] = useState(false);
	const [isDirty, setIsDirty] = useState(false);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const savedStatusRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isFirstRender = useRef(true);
	const updateMoves = useUpdateClimbMoves();

	const inputRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

	// ── DnD sensors: touch with 250ms long-press delay, pointer for dev ────────
	const sensors = useSensors(
		useSensor(TouchSensor, {
			activationConstraint: { delay: 250, tolerance: 5 },
		}),
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		}),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		setMovesList((items) => {
			const oldIndex = items.findIndex((m) => m.id === active.id);
			const newIndex = items.findIndex((m) => m.id === over.id);
			return arrayMove(items, oldIndex, newIndex);
		});
	};

	// ── Move editing ──────────────────────────────────────────────────────────

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

	const handleMoveFocus = (index: number) => {
		const el = inputRefs.current[index];
		if (!el) return;
		const scrollIntoViewAboveNavbar = () => {
			const rect = el.getBoundingClientRect();
			const navbarHeight = window.innerHeight * 0.07;
			const visibleBottom = window.innerHeight - navbarHeight - 8;
			if (rect.bottom > visibleBottom) {
				window.scrollBy({ top: rect.bottom - visibleBottom, behavior: "smooth" });
			}
		};
		// Run immediately, then again after the keyboard finishes opening
		scrollIntoViewAboveNavbar();
		setTimeout(scrollIntoViewAboveNavbar, 300);
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

	// ── Auto-save moves (edit mode only) ──────────────────────────────────────

	// biome-ignore lint/correctness/useExhaustiveDependencies: updateMoves.mutate is stable from useMutation
	useEffect(() => {
		if (!climbId) return;
		if (isFirstRender.current) {
			isFirstRender.current = false;
			return;
		}
		setIsDirty(true);
		setSaveStatus("idle");
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			setSaveStatus("saving");
			updateMoves.mutate(
				{ id: climbId, moves: JSON.stringify(movesList) },
				{
					onSuccess: () => {
						setIsDirty(false);
						setSaveStatus("saved");
						if (savedStatusRef.current) clearTimeout(savedStatusRef.current);
						savedStatusRef.current = setTimeout(
							() => setSaveStatus("idle"),
							2000,
						);
					},
					onError: () => {
						setSaveStatus("idle");
					},
				},
			);
		}, 1000);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [movesList, climbId]);

	// ── Navigation guard ──────────────────────────────────────────────────────

	const blocker = useBlocker({
		shouldBlockFn: () => !!climbId && isDirty,
		withResolver: true,
	});

	// ── Form ──────────────────────────────────────────────────────────────────

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
			// Cancel any pending auto-save; full save covers the moves too.
			if (debounceRef.current) clearTimeout(debounceRef.current);
			setIsDirty(false);
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
					<div className="flex flex-col gap-1 flex-1">
						<label htmlFor="grade" className="text-xs text-text-secondary">
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

				<form.Field name="sent_status">
					{(field) => (
						<ToggleGroup
							options={[
								{ value: "todo", label: "Todo" },
								{ value: "project", label: "Project" },
								{ value: "sent", label: "Sent" },
							]}
							value={field.state.value}
							onChange={(v) => field.handleChange(v as SentStatus)}
						/>
					)}
				</form.Field>

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

				<Button
					variant="outlined"
					className="w-full"
					onClick={() => setImportOpen(true)}
				>
					Import Beta
				</Button>

				<ImportBetaSheet
					isOpen={importOpen}
					onClose={() => setImportOpen(false)}
					onImport={(moves) => setMovesList(moves)}
				/>
			</div>

			<div className="w-full rounded-md bg-surface-card p-2 overflow-y-scroll">
				{climbId && saveStatus !== "idle" && (
					<p className="text-xs text-text-secondary mb-2 px-1">
						{saveStatus === "saving" ? "Saving…" : "Saved"}
					</p>
				)}
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={movesList.map((m) => m.id)}
						strategy={verticalListSortingStrategy}
					>
						{movesList.map((move, index) => (
							<SortableMoveRow
								key={move.id}
								move={move}
								index={index}
								onKeyDown={handleTextAreaKeyDown}
								onChange={handleMoveChange}
								onFocus={handleMoveFocus}
								setRef={(el, i) => {
									inputRefs.current[i] = el;
								}}
							/>
						))}
					</SortableContext>
				</DndContext>
			</div>

			<ConfirmDialog
				isOpen={blocker.status === "blocked"}
				title="Unsaved changes"
				message="You have unsaved changes. Leave anyway?"
				confirmLabel="Leave"
				cancelLabel="Stay"
				onConfirm={() => blocker.proceed?.()}
				onCancel={() => blocker.reset?.()}
			/>
		</form>
	);
};
