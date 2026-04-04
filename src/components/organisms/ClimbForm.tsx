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
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { ToggleGroup } from "@/components/atoms/ToggleGroup";
import { ConfirmDeleteDialog } from "@/components/molecules/ConfirmDeleteDialog";
import { GradeSelect } from "@/components/molecules/GradeSelect";
import { ImportBetaSheet } from "@/components/molecules/ImportBetaSheet";
import { useUpdateClimbMoves } from "@/features/climbs/climbs.queries";
import {
	type Beta,
	ClimbFormSchema,
	type ClimbFormValues,
	type MoveItem,
	parseBetas,
	type RouteType,
	type SentStatus,
} from "@/features/climbs/climbs.schema";
import type { Route } from "@/features/routes/routes.schema";
import { cn } from "@/lib/cn";

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
				className="flex-shrink-0 p-1 text-text-tertiary touch-none cursor-grab active:cursor-grabbing"
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
				className="flex-1 field-sizing-content outline-none bg-transparent min-h-[1.5rem]"
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
	/** Currently linked community route, shown as a summary card. */
	linkedRoute?: Pick<Route, "id" | "name" | "grade"> | null;
	/** Called when the user taps "Link to route" or "Change route". */
	onOpenRoutePicker?: () => void;
	/** Called when the user taps "Unlink". */
	onUnlinkRoute?: () => void;
	/** Whether to show the beta/moves section. Defaults to true. */
	showBeta?: boolean;
}

export const ClimbForm = ({
	defaultValues,
	onSubmit,
	climbId,
	linkedRoute,
	onOpenRoutePicker,
	onUnlinkRoute,
	showBeta = true,
}: ClimbFormProps) => {
	// ── Beta state ────────────────────────────────────────────────────────────
	// Use a ref to share the initial betas across the two useState initializers.
	const initialBetasRef = useRef<Beta[]>([]);

	const [betas, setBetas] = useState<Beta[]>(() => {
		let initial: Beta[];
		if (defaultValues?.moves) {
			try {
				const parsed = parseBetas(defaultValues.moves);
				initial =
					parsed.length > 0
						? parsed
						: [
								{
									id: uuid(),
									title: "Beta 1",
									moves: [{ id: uuid(), text: "" }],
								},
							];
			} catch {
				initial = [
					{ id: uuid(), title: "Beta 1", moves: [{ id: uuid(), text: "" }] },
				];
			}
		} else {
			initial = [
				{ id: uuid(), title: "Beta 1", moves: [{ id: uuid(), text: "" }] },
			];
		}
		initialBetasRef.current = initial;
		return initial;
	});

	const [activeBetaId, setActiveBetaId] = useState<string>(
		() => initialBetasRef.current[0]?.id ?? "",
	);
	const [galleryMode, setGalleryMode] = useState(false);

	// ── Derived ───────────────────────────────────────────────────────────────
	const activeBeta = betas.find((b) => b.id === activeBetaId) ?? betas[0];
	const activeMoves = activeBeta?.moves ?? [];
	const activeMoveCount = activeMoves.length;

	// ── Form metadata ─────────────────────────────────────────────────────────
	const [routeType, setRouteType] = useState<RouteType>(
		defaultValues?.route_type ?? "sport",
	);
	const [importOpen, setImportOpen] = useState(false);
	const [isDirty, setIsDirty] = useState(false);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [pendingDeleteBetaId, setPendingDeleteBetaId] = useState<string | null>(
		null,
	);

	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const savedStatusRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isFirstRender = useRef(true);
	const updateMoves = useUpdateClimbMoves();

	const inputRefs = useRef<Array<HTMLTextAreaElement | null>>([]);
	const pendingFocusIndex = useRef<number | null>(null);

	// ── DnD sensors: touch with 250ms long-press delay, pointer for dev ────────
	const sensors = useSensors(
		useSensor(TouchSensor, {
			activationConstraint: { delay: 250, tolerance: 5 },
		}),
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		}),
	);

	// ── Active-beta move helpers ───────────────────────────────────────────────

	const setActiveMoves = (updater: (moves: MoveItem[]) => MoveItem[]) => {
		const currentId = activeBeta?.id ?? activeBetaId;
		setBetas((prev) =>
			prev.map((b) =>
				b.id === currentId ? { ...b, moves: updater(b.moves) } : b,
			),
		);
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		setActiveMoves((moves) => {
			const oldIndex = moves.findIndex((m) => m.id === active.id);
			const newIndex = moves.findIndex((m) => m.id === over.id);
			return arrayMove(moves, oldIndex, newIndex);
		});
	};

	// ── Move editing ──────────────────────────────────────────────────────────

	const addMove = (id: string) => {
		setActiveMoves((moves) => {
			const index = moves.findIndex((x) => x.id === id);
			return [
				...moves.slice(0, index + 1),
				{ id: uuid(), text: "" },
				...moves.slice(index + 1),
			];
		});
	};

	const handleMoveChange = (
		e: React.ChangeEvent<HTMLTextAreaElement>,
		id: string,
	) => {
		setActiveMoves((moves) =>
			moves.map((m) => (m.id === id ? { ...m, text: e.target.value } : m)),
		);
	};

	const handleMoveDelete = (id: string) => {
		if (activeMoves.length > 1) {
			setActiveMoves((moves) => moves.filter((x) => x.id !== id));
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
				window.scrollBy({
					top: rect.bottom - visibleBottom,
					behavior: "smooth",
				});
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
			pendingFocusIndex.current =
				inputRefs.current.indexOf(e.currentTarget) + 1;
			addMove(id);
		}
		if (e.key === "Backspace" && e.currentTarget.value === "") {
			e.preventDefault();
			handleMoveDelete(id);
			const focusedIndex = getFocusedMoveIndex();
			inputRefs.current[focusedIndex - 1]?.focus();
		}
	};

	// Auto-focus the newly inserted move after Enter
	// biome-ignore lint/correctness/useExhaustiveDependencies: activeMoveCount is an intentional trigger
	useEffect(() => {
		if (pendingFocusIndex.current !== null) {
			const i = pendingFocusIndex.current;
			pendingFocusIndex.current = null;
			inputRefs.current[i]?.focus();
		}
	}, [activeMoveCount]);

	// ── Beta management ───────────────────────────────────────────────────────

	const updateActiveBetaTitle = (title: string) => {
		setBetas((prev) =>
			prev.map((b) => (b.id === activeBetaId ? { ...b, title } : b)),
		);
	};

	const addBeta = () => {
		const newBeta: Beta = {
			id: uuid(),
			title: `Beta ${betas.length + 1}`,
			moves: [{ id: uuid(), text: "" }],
		};
		setBetas((prev) => [...prev, newBeta]);
		setActiveBetaId(newBeta.id);
		setGalleryMode(false);
	};

	const deleteBeta = (betaId: string) => {
		if (betas.length <= 1) return;
		const remaining = betas.filter((b) => b.id !== betaId);
		setBetas(remaining);
		if (activeBetaId === betaId) {
			setActiveBetaId(remaining[0]?.id ?? "");
		}
	};

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
				{ id: climbId, moves: JSON.stringify(betas) },
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
	}, [betas, climbId]);

	// ── Navigation guard ──────────────────────────────────────────────────────

	const blocker = useBlocker({
		shouldBlockFn: () => !!climbId && isDirty,
		withResolver: true,
	});

	// ── Form ──────────────────────────────────────────────────────────────────

	const form = useForm({
		canSubmitWhenInvalid: true,
		defaultValues: {
			name: defaultValues?.name ?? "",
			route_type: defaultValues?.route_type ?? ("sport" as RouteType),
			grade: defaultValues?.grade ?? (routeType === "boulder" ? "v5" : "5.12a"),
			sent_status: defaultValues?.sent_status ?? "project",
			country: defaultValues?.country ?? "",
			area: defaultValues?.area ?? "",
			sub_area: defaultValues?.sub_area ?? "",
			crag: defaultValues?.crag ?? "",
			wall: defaultValues?.wall ?? "",
			route_location: defaultValues?.route_location ?? "",
			link: defaultValues?.link ?? "",
			sent_date: defaultValues?.sent_date ?? null,
		},
		onSubmit: async ({ value }) => {
			const gradeValue =
				value.grade || (routeType === "boulder" ? "v5" : "5.12a");
			const parsed = ClimbFormSchema.safeParse({
				...value,
				grade: gradeValue,
				moves: JSON.stringify(betas),
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
			className={
				showBeta
					? "grid grid-rows-[auto_1fr] h-full gap-4"
					: "flex flex-col gap-4"
			}
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
						<label htmlFor="route_type" className="text-xs text-text-secondary">
							Type
						</label>
						<form.Field name="route_type">
							{(field) => (
								<Select
									id="route_type"
									value={field.state.value}
									onChange={(e) => {
										const newType = e.target.value as RouteType;
										field.handleChange(newType);
										setRouteType(newType);
										form.setFieldValue(
											"grade",
											newType === "boulder" ? "v5" : "5.12a",
										);
									}}
									name="route_type"
								>
									<option value="sport">Sport</option>
									<option value="boulder">Boulder</option>
									<option value="trad">Trad</option>
								</Select>
							)}
						</form.Field>
					</div>
					<div className="flex flex-col gap-1 flex-1">
						<label htmlFor="grade" className="text-xs text-text-secondary">
							Personal grade
						</label>
						<form.Field name="grade">
							{(field) => (
								<GradeSelect
									id="grade"
									name="grade"
									routeType={routeType}
									value={field.state.value}
									onChange={(v) => field.handleChange(v)}
								/>
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
							onChange={(v) => {
								const newStatus = v as SentStatus;
								field.handleChange(newStatus);
								if (newStatus === "sent") {
									const today = new Date().toISOString().split("T")[0];
									form.setFieldValue(
										"sent_date",
										form.getFieldValue("sent_date") ?? today,
									);
								} else {
									form.setFieldValue("sent_date", null);
								}
							}}
						/>
					)}
				</form.Field>

				<form.Subscribe selector={(state) => state.values.sent_status}>
					{(sentStatus) =>
						sentStatus === "sent" ? (
							<form.Field name="sent_date">
								{(field) => (
									<div className="flex flex-col gap-1">
										<label
											htmlFor="sent_date"
											className="text-xs text-text-secondary"
										>
											Sent date
										</label>
										<Input
											id="sent_date"
											type="date"
											value={field.state.value ?? ""}
											onChange={(e) =>
												field.handleChange(e.target.value || null)
											}
											max={new Date().toISOString().split("T")[0]}
										/>
									</div>
								)}
							</form.Field>
						) : null
					}
				</form.Subscribe>

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

				{onOpenRoutePicker && (
					<div className="rounded-card bg-surface-card px-3 py-2.5">
						{linkedRoute ? (
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="text-sm font-medium text-text-primary truncate">
										{linkedRoute.name}
									</p>
									<p className="text-xs text-text-secondary">
										{linkedRoute.grade}
									</p>
								</div>
								<div className="flex items-center gap-3 shrink-0">
									<button
										type="button"
										onClick={onOpenRoutePicker}
										className="text-xs text-accent-primary"
									>
										Change
									</button>
									<button
										type="button"
										onClick={() => onUnlinkRoute?.()}
										className="text-xs text-text-muted"
									>
										Unlink
									</button>
								</div>
							</div>
						) : (
							<button
								type="button"
								onClick={onOpenRoutePicker}
								className="text-sm text-text-secondary w-full text-left"
							>
								+ Link to route
							</button>
						)}
					</div>
				)}

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

				{showBeta && (
					<>
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
							onImport={(moves) => setActiveMoves(() => moves)}
						/>
					</>
				)}
			</div>

			{showBeta && (
				<div className="w-full rounded-md bg-surface-card p-2 flex flex-col gap-2 overflow-y-auto">
					{/* Beta header: title input / gallery toggle / add beta */}
					<div className="flex items-center gap-2 px-1 min-h-[28px]">
						{galleryMode ? (
							<>
								<span className="flex-1 text-sm font-medium text-text-secondary">
									All betas
								</span>
								<button
									type="button"
									className="text-xs text-accent-primary shrink-0"
									onClick={() => setGalleryMode(false)}
								>
									Close
								</button>
							</>
						) : (
							<>
								<input
									type="text"
									className="flex-1 text-sm font-medium bg-transparent outline-none border-b border-text-muted pb-0.5 min-w-0"
									value={activeBeta?.title ?? ""}
									onChange={(e) => updateActiveBetaTitle(e.target.value)}
									placeholder="Beta title"
								/>
								{betas.length > 1 && (
									<button
										type="button"
										className="text-xs text-accent-primary shrink-0"
										onClick={() => setGalleryMode(true)}
									>
										Gallery
									</button>
								)}
							</>
						)}
						<button
							type="button"
							className="flex items-center gap-0.5 text-xs text-accent-primary shrink-0"
							onClick={addBeta}
						>
							<Plus size={12} />
							Add Beta
						</button>
					</div>

					{galleryMode ? (
						/* Gallery mode: horizontal snap-scroll cards */
						<div className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-2 px-2 pb-1">
							{betas.map((beta) => (
								// biome-ignore lint/a11y/useSemanticElements: contains nested button so cannot use <button>
								<div
									key={beta.id}
									role="button"
									tabIndex={0}
									className={cn(
										"snap-center shrink-0 w-40 rounded-md p-3 flex flex-col gap-1 bg-surface-input cursor-pointer",
										activeBetaId === beta.id && "ring-1 ring-accent-primary",
									)}
									onClick={() => {
										setActiveBetaId(beta.id);
										setGalleryMode(false);
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											setActiveBetaId(beta.id);
											setGalleryMode(false);
										}
									}}
								>
									<div className="flex items-center justify-between gap-1">
										<p className="font-medium text-sm truncate flex-1">
											{beta.title}
										</p>
										{betas.length > 1 && (
											<button
												type="button"
												className="text-text-muted shrink-0"
												onClick={(e) => {
													e.stopPropagation();
													setPendingDeleteBetaId(beta.id);
												}}
											>
												<Trash2 size={12} />
											</button>
										)}
									</div>
									<p className="text-xs text-text-secondary">
										{beta.moves.length} move
										{beta.moves.length !== 1 ? "s" : ""}
									</p>
									{beta.moves.slice(0, 2).map((m, i) => (
										<p key={m.id} className="text-xs text-text-muted truncate">
											{i + 1}. {m.text || "…"}
										</p>
									))}
								</div>
							))}
						</div>
					) : (
						/* Normal mode: save status + DnD moves */
						<>
							{climbId && saveStatus !== "idle" && (
								<p className="text-xs text-text-secondary px-1">
									{saveStatus === "saving" ? "Saving…" : "Saved"}
								</p>
							)}
							<DndContext
								sensors={sensors}
								collisionDetection={closestCenter}
								onDragEnd={handleDragEnd}
							>
								<SortableContext
									items={activeMoves.map((m) => m.id)}
									strategy={verticalListSortingStrategy}
								>
									{activeMoves.map((move, index) => (
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
						</>
					)}
				</div>
			)}

			<ConfirmDeleteDialog
				isOpen={pendingDeleteBetaId !== null}
				title="Delete beta"
				message={`Are you sure you want to delete ${betas.find((b) => b.id === pendingDeleteBetaId)?.title ?? ""} beta?`}
				confirmLabel="Delete"
				onConfirm={() => {
					if (pendingDeleteBetaId) deleteBeta(pendingDeleteBetaId);
					setPendingDeleteBetaId(null);
				}}
				onCancel={() => setPendingDeleteBetaId(null)}
			/>
			<ConfirmDeleteDialog
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
