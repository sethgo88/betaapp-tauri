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
import { uuid } from "@tanstack/react-form";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	GripVertical,
	Plus,
	Settings,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/date";
import { Button } from "@/components/atoms/Button";
import { FeelSlider } from "@/components/atoms/FeelSlider";
import { Input } from "@/components/atoms/Input";
import { Spinner } from "@/components/atoms/Spinner";
import { ToggleGroup } from "@/components/atoms/ToggleGroup";
import { ClimbImageGallery } from "@/components/molecules/ClimbImageGallery";
import { ConfirmDeleteDialog } from "@/components/molecules/ConfirmDeleteDialog";
import { ImportBetaSheet } from "@/components/molecules/ImportBetaSheet";
import { RoutePickerSheet } from "@/components/molecules/RoutePickerSheet";
import {
	useAddBurn,
	useBurns,
	useDeleteBurn,
	useUpdateBurn,
} from "@/features/burns/burns.queries";
import {
	useClimb,
	useDeleteClimb,
	useLinkClimbToRoute,
	usePatchClimbGrade,
	usePatchClimbLink,
	usePatchClimbStatus,
	useUnlinkClimbFromRoute,
	useUpdateClimbMoves,
} from "@/features/climbs/climbs.queries";
import {
	type Beta,
	type MoveItem,
	parseBetas,
} from "@/features/climbs/climbs.schema";
import { useClimbsStore } from "@/features/climbs/climbs.store";
import { useGrades } from "@/features/grades/grades.queries";
import { useRoute } from "@/features/routes/routes.queries";
import type { Route } from "@/features/routes/routes.schema";
import { cn } from "@/lib/cn";
import { buildLocationString } from "@/utils/build-location-string";

// ── Feel labels ───────────────────────────────────────────────────────────────

const FEEL_LABELS: Record<number, string> = {
	0: "Impossible",
	1: "Very far",
	2: "Far",
	3: "Getting closer",
	4: "Close",
	5: "It will go",
};

// ── Sortable move row (for BetaEditSheet) ─────────────────────────────────────

interface SortableMoveRowProps {
	move: MoveItem;
	onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string) => void;
	onChange: (e: React.ChangeEvent<HTMLTextAreaElement>, id: string) => void;
	setRef: (el: HTMLTextAreaElement | null) => void;
	onFocus: () => void;
}

const SortableMoveRow = ({
	move,
	onKeyDown,
	onChange,
	setRef,
	onFocus,
}: SortableMoveRowProps) => {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
		useSortable({ id: move.id });

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.4 : 1,
		touchAction: "none",
	};

	return (
		<div ref={setNodeRef} style={style} className="flex items-start gap-1">
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
				onFocus={onFocus}
				className="flex-1 field-sizing-content outline-none bg-transparent min-h-[1.5rem]"
				value={move.text}
				ref={setRef}
			/>
		</div>
	);
};

// ── Beta edit sheet ───────────────────────────────────────────────────────────

interface BetaEditSheetProps {
	beta: Beta;
	allBetas: Beta[];
	climbId: string;
	onClose: () => void;
}

type SaveStatus = "idle" | "saving" | "saved";

const BetaEditSheet = ({
	beta,
	allBetas,
	climbId,
	onClose,
}: BetaEditSheetProps) => {
	const [title, setTitle] = useState(beta.title);
	const [moves, setMoves] = useState<MoveItem[]>(
		beta.moves.length > 0 ? beta.moves : [{ id: uuid(), text: "" }],
	);
	const [isDirty, setIsDirty] = useState(false);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [confirmLeave, setConfirmLeave] = useState(false);
	const updateMoves = useUpdateClimbMoves();
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const savedStatusRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isFirstRender = useRef(true);
	const inputRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

	const sensors = useSensors(
		useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		setMoves((prev) => {
			const oldIndex = prev.findIndex((m) => m.id === active.id);
			const newIndex = prev.findIndex((m) => m.id === over.id);
			return arrayMove(prev, oldIndex, newIndex);
		});
	};

	const addMove = (id: string) => {
		setMoves((prev) => {
			const index = prev.findIndex((m) => m.id === id);
			return [
				...prev.slice(0, index + 1),
				{ id: uuid(), text: "" },
				...prev.slice(index + 1),
			];
		});
	};

	const handleMoveChange = (
		e: React.ChangeEvent<HTMLTextAreaElement>,
		id: string,
	) => {
		setMoves((prev) =>
			prev.map((m) => (m.id === id ? { ...m, text: e.target.value } : m)),
		);
	};

	const handleMoveDelete = (id: string) => {
		if (moves.length > 1) {
			setMoves((prev) => prev.filter((m) => m.id !== id));
		}
	};

	const handleKeyDown = (
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
			const focusedIndex = inputRefs.current.findIndex(
				(el) => el === document.activeElement,
			);
			inputRefs.current[focusedIndex - 1]?.focus();
		}
	};

	// Auto-save on changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: updateMoves.mutate is stable
	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false;
			return;
		}
		setIsDirty(true);
		setSaveStatus("idle");
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			setSaveStatus("saving");
			const updatedBetas = allBetas.map((b) =>
				b.id === beta.id ? { ...b, title, moves } : b,
			);
			updateMoves.mutate(
				{ id: climbId, moves: JSON.stringify(updatedBetas) },
				{
					onSuccess: () => {
						setIsDirty(false);
						setSaveStatus("saved");
						if (savedStatusRef.current) clearTimeout(savedStatusRef.current);
						savedStatusRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
					},
					onError: () => setSaveStatus("idle"),
				},
			);
		}, 1000);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [title, moves]);

	const handleSave = () => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		const updatedBetas = allBetas.map((b) =>
			b.id === beta.id ? { ...b, title, moves } : b,
		);
		updateMoves.mutate(
			{ id: climbId, moves: JSON.stringify(updatedBetas) },
			{ onSuccess: () => onClose() },
		);
	};

	const handleCancel = () => {
		if (isDirty) {
			setConfirmLeave(true);
		} else {
			onClose();
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-surface-page pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
			{/* Fixed header */}
			<div className="flex items-center gap-2 px-4 py-3 border-b border-border-default shrink-0">
				<input
					type="text"
					className="flex-1 text-base font-semibold bg-transparent outline-none text-text-primary min-w-0"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="Beta title"
				/>
				{saveStatus !== "idle" && (
					<span className="text-xs text-text-secondary shrink-0">
						{saveStatus === "saving" ? "Saving…" : "Saved"}
					</span>
				)}
			</div>

			{/* Scrollable moves */}
			<div className="flex-1 overflow-y-auto px-4 py-4">
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={moves.map((m) => m.id)}
						strategy={verticalListSortingStrategy}
					>
						{moves.map((move, index) => (
							<SortableMoveRow
								key={move.id}
								move={move}
								onKeyDown={handleKeyDown}
								onChange={handleMoveChange}
								onFocus={() => {
									const el = inputRefs.current[index];
									if (!el) return;
									setTimeout(() => {
										const rect = el.getBoundingClientRect();
										const navbarHeight = window.innerHeight * 0.07;
										if (rect.bottom > window.innerHeight - navbarHeight - 8) {
											window.scrollBy({ top: rect.bottom - (window.innerHeight - navbarHeight - 8), behavior: "smooth" });
										}
									}, 300);
								}}
								setRef={(el) => {
									inputRefs.current[index] = el;
								}}
							/>
						))}
					</SortableContext>
				</DndContext>
			</div>

			{/* Fixed footer */}
			<div className="flex gap-2 px-4 py-3 border-t border-border-default shrink-0">
				<Button className="flex-1" onClick={handleSave} disabled={updateMoves.isPending}>
					Save
				</Button>
				<Button className="flex-1" variant="outlined" onClick={handleCancel}>
					Cancel
				</Button>
			</div>

			<ConfirmDeleteDialog
				isOpen={confirmLeave}
				title="Unsaved changes"
				message="You have unsaved changes. Leave anyway?"
				confirmLabel="Leave"
				cancelLabel="Stay"
				onConfirm={() => onClose()}
				onCancel={() => setConfirmLeave(false)}
			/>
		</div>
	);
};

// ── Beta carousel ─────────────────────────────────────────────────────────────

interface BetaCarouselProps {
	betas: Beta[];
	climbId: string;
	onBetasChange: (betas: Beta[]) => void;
}

const BetaCarousel = ({ betas, climbId, onBetasChange }: BetaCarouselProps) => {
	// Total slots: betas + 1 "add new" card at the end
	const total = betas.length + 1;
	const addIndex = betas.length;
	const [activeIndex, setActiveIndex] = useState(0);
	const [gearOpenId, setGearOpenId] = useState<string | null>(null);
	const [pendingDeleteBetaId, setPendingDeleteBetaId] = useState<string | null>(null);
	const [editingBetaId, setEditingBetaId] = useState<string | null>(null);
	const [importOpen, setImportOpen] = useState(false);

	// Swipe tracking
	const touchStartX = useRef<number | null>(null);
	const updateMoves = useUpdateClimbMoves();

	const [newBetaTitle, setNewBetaTitle] = useState("");

	const goTo = (index: number) => {
		// Circular wrap
		if (index < 0) {
			setActiveIndex(total - 1);
		} else if (index >= total) {
			setActiveIndex(0);
		} else {
			setActiveIndex(index);
		}
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		touchStartX.current = e.touches[0].clientX;
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		if (touchStartX.current === null) return;
		const delta = e.changedTouches[0].clientX - touchStartX.current;
		touchStartX.current = null;
		if (Math.abs(delta) < 40) return;
		if (delta < 0) goTo(activeIndex + 1);
		else goTo(activeIndex - 1);
	};

	const handleAddBeta = () => {
		const title = newBetaTitle.trim() || `Beta ${betas.length + 1}`;
		const newBeta: Beta = {
			id: uuid(),
			title,
			moves: [{ id: uuid(), text: "" }],
		};
		const updated = [...betas, newBeta];
		onBetasChange(updated);
		updateMoves.mutate({ id: climbId, moves: JSON.stringify(updated) });
		setNewBetaTitle("");
		setActiveIndex(betas.length); // points to the newly added beta (was addIndex, now last beta)
	};

	const handleDeleteBeta = (betaId: string) => {
		if (betas.length <= 1) return;
		const updated = betas.filter((b) => b.id !== betaId);
		onBetasChange(updated);
		updateMoves.mutate({ id: climbId, moves: JSON.stringify(updated) });
		if (activeIndex >= updated.length) setActiveIndex(Math.max(0, updated.length - 1));
	};

	const handleImport = (moves: MoveItem[]) => {
		const newBeta: Beta = {
			id: uuid(),
			title: `Beta ${betas.length + 1}`,
			moves,
		};
		const updated = [...betas, newBeta];
		onBetasChange(updated);
		updateMoves.mutate({ id: climbId, moves: JSON.stringify(updated) });
		setActiveIndex(betas.length);
	};

	const editingBeta = betas.find((b) => b.id === editingBetaId);

	return (
		<div className="rounded-md bg-surface-card overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-3 pt-3 pb-2">
				<span className="text-sm font-medium text-text-secondary">
					Betas{betas.length > 1 ? ` (${betas.length})` : ""}
				</span>
				<div className="flex items-center gap-2">
					{total > 1 && (
						<div className="flex items-center gap-1">
							{Array.from({ length: total }).map((_, i) => (
								<button
									// biome-ignore lint/suspicious/noArrayIndexKey: positional dots
									key={i}
									type="button"
									onClick={() => goTo(i)}
									className={cn(
										"w-1.5 h-1.5 rounded-full transition-colors",
										i === activeIndex
											? "bg-accent-primary"
											: "bg-text-tertiary",
									)}
								/>
							))}
						</div>
					)}
					<button
						type="button"
						className="text-xs text-accent-primary"
						onClick={() => setImportOpen(true)}
					>
						Import
					</button>
				</div>
			</div>

			{/* Carousel */}
			<div
				className="relative overflow-hidden"
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
			>
				<div
					className="flex transition-transform duration-200"
					style={{ transform: `translateX(-${activeIndex * 100}%)` }}
				>
					{betas.map((beta) => (
						<div key={beta.id} className="w-full shrink-0 px-3 pb-3">
							{/* Beta card header */}
							<div className="flex items-center justify-between mb-2 relative">
								<span className="text-sm font-medium">{beta.title}</span>
								<button
									type="button"
									className="p-1 text-text-secondary"
									onClick={() =>
										setGearOpenId(gearOpenId === beta.id ? null : beta.id)
									}
								>
									<Settings size={15} />
								</button>
								{gearOpenId === beta.id && (
									<div className="absolute right-0 top-7 z-10 bg-surface-card border border-border-default rounded-lg shadow-lg min-w-[120px] overflow-hidden">
										<button
											type="button"
											className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-hover"
											onClick={() => {
												setEditingBetaId(beta.id);
												setGearOpenId(null);
											}}
										>
											Edit
										</button>
										{betas.length > 1 && (
											<button
												type="button"
												className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-surface-hover"
												onClick={() => {
													setPendingDeleteBetaId(beta.id);
													setGearOpenId(null);
												}}
											>
												Delete
											</button>
										)}
									</div>
								)}
							</div>

							{/* Moves list */}
							{beta.moves.length > 0 ? (
								<ul className="flex flex-col gap-1">
									{beta.moves.map((move) => (
										<li
											key={move.id}
											className="border-l border-text-primary pl-2 text-sm"
										>
											{move.text}
										</li>
									))}
								</ul>
							) : (
								<p className="text-sm text-text-secondary">No moves logged yet.</p>
							)}
						</div>
					))}

					{/* Add new beta card */}
					<div className="w-full shrink-0 px-3 pb-3">
						<p className="text-sm font-medium mb-2 text-text-secondary">
							Add new beta
						</p>
						<Input
							placeholder="Beta title (optional)"
							value={newBetaTitle}
							onChange={(e) => setNewBetaTitle(e.target.value)}
						/>
						<Button
							size="small"
							className="mt-2 w-full"
							onClick={handleAddBeta}
						>
							<Plus size={14} className="mr-1" />
							Add
						</Button>
					</div>
				</div>
			</div>

			{/* Nav arrows when >1 card */}
			{total > 1 && (
				<div className="flex justify-between px-1 pb-2">
					<button
						type="button"
						className="p-1 text-text-secondary"
						onClick={() => goTo(activeIndex - 1)}
					>
						<ChevronLeft size={16} />
					</button>
					<button
						type="button"
						className="p-1 text-text-secondary"
						onClick={() => goTo(activeIndex + 1)}
					>
						<ChevronRight size={16} />
					</button>
				</div>
			)}

			{pendingDeleteBetaId !== null && (
				<ConfirmDeleteDialog
					isOpen
					title="Delete beta"
					message={`Are you sure you want to delete "${betas.find((b) => b.id === pendingDeleteBetaId)?.title ?? ""}"?`}
					onConfirm={() => {
						if (pendingDeleteBetaId) handleDeleteBeta(pendingDeleteBetaId);
						setPendingDeleteBetaId(null);
					}}
					onCancel={() => setPendingDeleteBetaId(null)}
				/>
			)}

			{editingBeta && (
				<BetaEditSheet
					beta={editingBeta}
					allBetas={betas}
					climbId={climbId}
					onClose={() => setEditingBetaId(null)}
				/>
			)}

			<ImportBetaSheet
				isOpen={importOpen}
				onClose={() => setImportOpen(false)}
				onImport={handleImport}
			/>
		</div>
	);
};

// ── Climb detail view ─────────────────────────────────────────────────────────

const ClimbDetailView = () => {
	const { climbId } = useParams({ from: "/climbs/$climbId" });
	const navigate = useNavigate();
	const { data: climb, isLoading } = useClimb(climbId);
	const { data: linkedRoute } = useRoute(climb?.route_id);
	const { data: burns } = useBurns(climbId);
	const addBurn = useAddBurn();
	const updateBurn = useUpdateBurn();
	const deleteBurn = useDeleteBurn();
	const deleteClimb = useDeleteClimb();
	const unlinkClimb = useUnlinkClimbFromRoute();
	const linkClimb = useLinkClimbToRoute();
	const patchGrade = usePatchClimbGrade();
	const patchStatus = usePatchClimbStatus();
	const patchLink = usePatchClimbLink();
	const setSelectedClimbId = useClimbsStore((s) => s.setSelectedClimbId);

	const { data: grades = [] } = useGrades(
		(climb?.route_type as "sport" | "boulder" | "trad") ?? "sport",
	);

	const [betas, setBetas] = useState<Beta[]>([]);
	const [betasInitialized, setBetasInitialized] = useState(false);

	const [confirmDelete, setConfirmDelete] = useState(false);
	const [pendingDeleteBurnId, setPendingDeleteBurnId] = useState<string | null>(null);
	const [gearMenuOpen, setGearMenuOpen] = useState(false);
	const [gradePickerOpen, setGradePickerOpen] = useState(false);
	const [routePickerOpen, setRoutePickerOpen] = useState(false);
	const [linkEditing, setLinkEditing] = useState(false);
	const [linkValue, setLinkValue] = useState("");

	const [burnsOpen, setBurnsOpen] = useState(false);
	const [showAddBurn, setShowAddBurn] = useState(false);
	const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [addNotes, setAddNotes] = useState("");
	const [addFeel, setAddFeel] = useState<number | null>(null);
	const [editingBurnId, setEditingBurnId] = useState<string | null>(null);
	const [editDate, setEditDate] = useState("");
	const [editNotes, setEditNotes] = useState("");
	const [editFeel, setEditFeel] = useState<number | null>(null);

	useEffect(() => {
		setSelectedClimbId(climbId);
		return () => setSelectedClimbId(null);
	}, [climbId, setSelectedClimbId]);

	// Initialise betas from climb data once loaded
	useEffect(() => {
		if (climb && !betasInitialized) {
			setBetas(parseBetas(climb.moves));
			setBetasInitialized(true);
		}
	}, [climb, betasInitialized]);

	// Sync link value from climb
	useEffect(() => {
		if (climb) setLinkValue(climb.link ?? "");
	}, [climb]);

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	if (!climb) {
		return (
			<p className="text-text-secondary text-center pt-12">Climb not found.</p>
		);
	}

	const location = buildLocationString([
		climb.country,
		climb.area,
		climb.sub_area,
		climb.crag,
		climb.wall,
	]);

	const handleRouteSelect = (route: Route) => {
		linkClimb.mutate({ climbId, routeId: route.id });
	};

	const handleLinkSave = () => {
		patchLink.mutate({ id: climbId, link: linkValue || null });
		setLinkEditing(false);
	};

	return (
		<div className="flex flex-col gap-4">
			<ClimbImageGallery climbId={climbId} />

			{/* Title + grade + location */}
			<div className="flex items-start justify-between">
				<div>
					{climb.route_id ? (
						<button
							type="button"
							className="flex items-center gap-1.5 text-left"
							onClick={() =>
								navigate({
									to: "/routes/$routeId",
									params: { routeId: climb.route_id as string },
								})
							}
						>
							<h1 className="text-2xl font-display font-bold">{climb.name}</h1>
							<ExternalLink size={16} className="text-text-secondary shrink-0 mt-1" />
						</button>
					) : (
						<h1 className="text-2xl font-display font-bold">{climb.name}</h1>
					)}
					{location && (
						<p className="text-sm text-text-secondary">{location}</p>
					)}
				</div>

				{/* Grade + gear icon */}
				<div className="flex items-start gap-2">
					<div className="text-right flex flex-col items-end gap-0.5 relative">
						{/* Tappable personal grade */}
						<button
							type="button"
							className="flex items-baseline gap-1.5 group"
							onClick={() => setGradePickerOpen(!gradePickerOpen)}
						>
							<span className="text-xs text-text-secondary">Personal</span>
							<span className="text-lg font-display font-semibold underline decoration-dotted">
								{climb.grade}
							</span>
						</button>

						{/* Grade dropdown */}
						{gradePickerOpen && grades.length > 0 && (
							<div className="absolute right-0 top-8 z-20 bg-surface-card border border-border-default rounded-lg shadow-lg max-h-48 overflow-y-auto min-w-[80px]">
								{grades.map((g) => (
									<button
										key={g.id}
										type="button"
										className={cn(
											"w-full text-left px-4 py-2 text-sm hover:bg-surface-hover",
											g.grade === climb.grade && "text-accent-primary font-medium",
										)}
										onClick={() => {
											patchGrade.mutate({ id: climbId, grade: g.grade });
											setGradePickerOpen(false);
										}}
									>
										{g.grade}
									</button>
								))}
							</div>
						)}

						{linkedRoute && (
							<div className="flex items-baseline gap-1.5">
								<span className="text-xs text-text-secondary">Official</span>
								<span className="text-lg font-display font-semibold">
									{linkedRoute.grade}
								</span>
							</div>
						)}
						<p className="text-xs text-text-secondary capitalize">
							{climb.route_type}
						</p>
					</div>

					{/* Gear icon menu */}
					<div className="relative">
						<button
							type="button"
							className="p-1 text-text-secondary mt-0.5"
							onClick={() => {
								setGearMenuOpen(!gearMenuOpen);
								setGradePickerOpen(false);
							}}
						>
							<Settings size={18} />
						</button>

						{gearMenuOpen && (
							<div className="absolute right-0 top-8 z-20 bg-surface-card border border-border-default rounded-lg shadow-lg min-w-[160px] overflow-hidden">
								{climb.route_id ? (
									<button
										type="button"
										className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-hover"
										onClick={() => {
											unlinkClimb.mutate(climb.id);
											setGearMenuOpen(false);
										}}
									>
										Unlink route
									</button>
								) : (
									<button
										type="button"
										className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-hover"
										onClick={() => {
											setRoutePickerOpen(true);
											setGearMenuOpen(false);
										}}
									>
										Link to route
									</button>
								)}
								<button
									type="button"
									className="w-full text-left px-4 py-2.5 text-sm text-destructive hover:bg-surface-hover"
									onClick={() => {
										setConfirmDelete(true);
										setGearMenuOpen(false);
									}}
								>
									Delete
								</button>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Close overlays on outside tap */}
			{(gearMenuOpen || gradePickerOpen) && (
				// biome-ignore lint/a11y/useSemanticElements: transparent overlay
				<div
					role="button"
					tabIndex={-1}
					className="fixed inset-0 z-10"
					onClick={() => {
						setGearMenuOpen(false);
						setGradePickerOpen(false);
					}}
					onKeyDown={() => {}}
					aria-label="Close menu"
				/>
			)}

			{/* Status toggle: sent/project/todo */}
			<ToggleGroup
				options={[
					{ value: "todo", label: "Todo" },
					{ value: "project", label: "Project" },
					{ value: "sent", label: "Sent" },
				]}
				value={["todo", "project", "sent"].includes(climb.sent_status)
					? climb.sent_status
					: "project"}
				onChange={(v) => patchStatus.mutate({ id: climbId, sentStatus: v })}
			/>

			{/* Betas */}
			<BetaCarousel
				betas={betas}
				climbId={climbId}
				onBetasChange={setBetas}
			/>

			{/* Burns section */}
			<div className="rounded-md bg-surface-card">
				<button
					type="button"
					className="flex items-center justify-between w-full p-3 text-sm text-text-secondary"
					onClick={() => setBurnsOpen(!burnsOpen)}
				>
					<span>Burns ({burns?.length ?? 0})</span>
					<span
						className={cn(
							"transition-transform inline-block",
							burnsOpen && "rotate-180",
						)}
					>
						▾
					</span>
				</button>
				{burnsOpen && (
					<div className="flex flex-col gap-2 px-3 pb-3">
						<Button
							size="small"
							variant="outlined"
							className="flex items-center gap-1 self-start"
							onClick={() => {
								setShowAddBurn(!showAddBurn);
								setAddDate(new Date().toISOString().slice(0, 10));
								setAddNotes("");
							}}
						>
							<Plus size={14} />
							Add burn
						</Button>

						{showAddBurn && (
							<div className="rounded-[var(--radius-md)] bg-surface-input p-3 flex flex-col gap-2">
								<Input
									type="date"
									value={addDate}
									onChange={(e) => setAddDate(e.target.value)}
								/>
								<Input
									placeholder="Notes (optional)"
									value={addNotes}
									onChange={(e) => setAddNotes(e.target.value)}
								/>
								<FeelSlider value={addFeel} onChange={setAddFeel} />
								<Button
									size="small"
									disabled={!addDate || addBurn.isPending}
									onClick={() => {
										addBurn.mutate(
											{
												climbId,
												data: {
													date: addDate,
													notes: addNotes || undefined,
													feel: addFeel,
												},
											},
											{
												onSuccess: () => {
													setShowAddBurn(false);
													setAddDate(new Date().toISOString().slice(0, 10));
													setAddNotes("");
													setAddFeel(null);
												},
											},
										);
									}}
								>
									Save
								</Button>
							</div>
						)}

						{burns && burns.length > 0 ? (
							<ul className="flex flex-col gap-2">
								{burns.map((burn) => (
									<li key={burn.id} className="border-l border-text-primary pl-2">
										{editingBurnId === burn.id ? (
											<div className="flex flex-col gap-2">
												<Input
													type="date"
													value={editDate}
													onChange={(e) => setEditDate(e.target.value)}
												/>
												<Input
													placeholder="Notes (optional)"
													value={editNotes}
													onChange={(e) => setEditNotes(e.target.value)}
												/>
												<FeelSlider value={editFeel} onChange={setEditFeel} />
												<div className="flex gap-2">
													<Button
														size="small"
														disabled={!editDate || updateBurn.isPending}
														onClick={() => {
															updateBurn.mutate(
																{
																	id: burn.id,
																	data: {
																		date: editDate,
																		notes: editNotes || undefined,
																		feel: editFeel,
																	},
																},
																{ onSuccess: () => setEditingBurnId(null) },
															);
														}}
													>
														Save
													</Button>
													<Button
														size="small"
														variant="outlined"
														onClick={() => setEditingBurnId(null)}
													>
														Cancel
													</Button>
												</div>
											</div>
										) : (
											<div className="flex items-center justify-between">
												<div>
													<p className="text-sm font-semibold">{formatDate(burn.date)}</p>
													{burn.feel != null && (
														<p className="text-xs text-accent-primary">
															{FEEL_LABELS[burn.feel]}
														</p>
													)}
													{burn.notes && (
														<p className="text-sm text-text-secondary">{burn.notes}</p>
													)}
												</div>
												<div className="flex items-center gap-3">
													<button
														type="button"
														className="text-xs text-text-secondary"
														onClick={() => {
															setEditingBurnId(burn.id);
															setEditDate(burn.date);
															setEditNotes(burn.notes ?? "");
															setEditFeel(burn.feel ?? null);
														}}
													>
														Edit
													</button>
													<button
														type="button"
														className="text-xs text-text-secondary"
														onClick={() => setPendingDeleteBurnId(burn.id)}
													>
														Delete
													</button>
												</div>
											</div>
										)}
									</li>
								))}
							</ul>
						) : (
							<p className="text-sm text-text-secondary">No burns logged yet.</p>
						)}
					</div>
				)}
			</div>

			{/* Link section */}
			{linkEditing ? (
				<div className="flex gap-2">
					<Input
						type="text"
						placeholder="https://…"
						value={linkValue}
						onChange={(e) => setLinkValue(e.target.value)}
						className="flex-1"
					/>
					<Button size="small" onClick={handleLinkSave}>
						Save
					</Button>
					<Button
						size="small"
						variant="outlined"
						onClick={() => {
							setLinkValue(climb.link ?? "");
							setLinkEditing(false);
						}}
					>
						Cancel
					</Button>
				</div>
			) : climb.link ? (
				<div className="flex items-center gap-2">
					<a
						href={climb.link}
						target="_blank"
						rel="noreferrer"
						className="text-accent-primary text-sm underline flex-1 truncate"
					>
						{climb.link}
					</a>
					<button
						type="button"
						className="text-xs text-text-secondary shrink-0"
						onClick={() => setLinkEditing(true)}
					>
						Edit
					</button>
				</div>
			) : (
				<button
					type="button"
					className="text-sm text-text-secondary self-start"
					onClick={() => setLinkEditing(true)}
				>
					+ Add link
				</button>
			)}

			{/* Modals */}
			<ConfirmDeleteDialog
				isOpen={confirmDelete}
				title="Delete climb"
				message={`Are you sure you want to delete "${climb.name}"? This can't be undone.`}
				onConfirm={() => {
					deleteClimb.mutate(climb.id, {
						onSuccess: () => navigate({ to: "/" }),
					});
					setConfirmDelete(false);
				}}
				onCancel={() => setConfirmDelete(false)}
			/>

			<ConfirmDeleteDialog
				isOpen={pendingDeleteBurnId !== null}
				title="Delete burn"
				message="Are you sure you want to delete this burn?"
				onConfirm={() => {
					if (pendingDeleteBurnId) deleteBurn.mutate(pendingDeleteBurnId);
					setPendingDeleteBurnId(null);
				}}
				onCancel={() => setPendingDeleteBurnId(null)}
			/>

			<RoutePickerSheet
				isOpen={routePickerOpen}
				onClose={() => setRoutePickerOpen(false)}
				onSelect={handleRouteSelect}
			/>
		</div>
	);
};

export default ClimbDetailView;
