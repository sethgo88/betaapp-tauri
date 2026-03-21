import { X } from "lucide-react";
import { useRef, useState } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import {
	useDeleteRouteTopo,
	useDeleteWallTopo,
	useDeleteWallTopoLine,
	useUploadWallTopoImage,
	useUpsertRouteTopo,
	useUpsertWallTopoLine,
} from "@/features/topos/topos.queries";
import {
	type Point,
	type RouteTopo,
	topoColor,
	type WallTopo,
	type WallTopoLine,
} from "@/features/topos/topos.schema";

// ── Color picker ──────────────────────────────────────────────────────────────

const LINE_COLORS = [
	"#EF4444", // red
	"#F97316", // orange
	"#EAB308", // yellow
	"#22C55E", // green
	"#3B82F6", // blue
	"#8B5CF6", // violet
	"#000000", // black
	"#FFFFFF", // white
] as const;

const ColorPicker = ({
	value,
	onChange,
}: {
	value: string;
	onChange: (color: string) => void;
}) => (
	<div className="flex gap-2">
		{LINE_COLORS.map((c) => (
			<button
				key={c}
				type="button"
				onClick={() => onChange(c)}
				className="w-7 h-7 rounded-full flex-shrink-0"
				style={{
					backgroundColor: c,
					border: c === "#FFFFFF" ? "1px solid rgba(255,255,255,0.3)" : "none",
					boxShadow: value === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none",
				}}
				aria-label={c}
			/>
		))}
	</div>
);

// ── Shared SVG drawing canvas ─────────────────────────────────────────────────

// Handle dots are rendered as HTML divs (not SVG circles) so their size is
// true screen pixels regardless of the SVG viewBox coordinate scale.
const HANDLE_SIZE = 8; // px — screen pixel diameter for point handles
const MID_HANDLE_SIZE = 6; // px — screen pixel diameter for midpoint handles
const HIT_RADIUS = 24; // px — touch hit area radius

interface DrawingCanvasProps {
	imageUrl: string;
	draftPoints: Point[];
	savedLines: { points: Point[]; color: string; routeId: string }[];
	activeColor: string;
	onAddPoint: (p: Point) => void;
	onMovePoint: (index: number, p: Point) => void;
	onInsertMidpoint: (afterIndex: number, p: Point) => void;
}

const DrawingCanvas = ({
	imageUrl,
	draftPoints,
	savedLines,
	activeColor,
	onAddPoint,
	onMovePoint,
	onInsertMidpoint,
}: DrawingCanvasProps) => {
	const containerRef = useRef<HTMLDivElement>(null);
	// Track which handle is being dragged: { type: 'point' | 'mid', index }
	const dragRef = useRef<{ type: "point" | "mid"; index: number } | null>(null);

	const pctFromEvent = (clientX: number, clientY: number): Point | null => {
		const el = containerRef.current;
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		return {
			x_pct: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
			y_pct: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
		};
	};

	const nearestHandle = (
		clientX: number,
		clientY: number,
	): { type: "point" | "mid"; index: number } | null => {
		const el = containerRef.current;
		if (!el) return null;
		const rect = el.getBoundingClientRect();
		const px = clientX - rect.left;
		const py = clientY - rect.top;

		// Check existing points first
		for (let i = 0; i < draftPoints.length; i++) {
			const hx = draftPoints[i].x_pct * rect.width;
			const hy = draftPoints[i].y_pct * rect.height;
			if (Math.hypot(px - hx, py - hy) < HIT_RADIUS) {
				return { type: "point", index: i };
			}
		}

		// Check midpoint handles
		for (let i = 0; i < draftPoints.length - 1; i++) {
			const mx =
				((draftPoints[i].x_pct + draftPoints[i + 1].x_pct) / 2) * rect.width;
			const my =
				((draftPoints[i].y_pct + draftPoints[i + 1].y_pct) / 2) * rect.height;
			if (Math.hypot(px - mx, py - my) < HIT_RADIUS) {
				return { type: "mid", index: i };
			}
		}

		return null;
	};

	const handleTouchStart = (e: React.TouchEvent) => {
		if (e.touches.length !== 1) return;
		const touch = e.touches[0];
		const hit = nearestHandle(touch.clientX, touch.clientY);
		if (hit) {
			e.preventDefault();
			if (hit.type === "mid") {
				// Insert the point immediately so dragging tracks the finger live
				const p = pctFromEvent(touch.clientX, touch.clientY);
				if (p) {
					onInsertMidpoint(hit.index, p);
					dragRef.current = { type: "point", index: hit.index + 1 };
				}
			} else {
				dragRef.current = hit;
			}
		}
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (!dragRef.current || e.touches.length !== 1) return;
		e.preventDefault();
		const touch = e.touches[0];
		const p = pctFromEvent(touch.clientX, touch.clientY);
		if (!p) return;
		onMovePoint(dragRef.current.index, p);
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		if (e.changedTouches.length !== 1) return;

		if (dragRef.current) {
			dragRef.current = null;
			return;
		}

		// No drag — it was a tap → add point
		const touch = e.changedTouches[0];
		const p = pctFromEvent(touch.clientX, touch.clientY);
		if (p) onAddPoint(p);
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		const hit = nearestHandle(e.clientX, e.clientY);
		if (hit) {
			if (hit.type === "mid") {
				// Insert the point immediately so dragging tracks the cursor live
				const p = pctFromEvent(e.clientX, e.clientY);
				if (p) {
					onInsertMidpoint(hit.index, p);
					dragRef.current = { type: "point", index: hit.index + 1 };
				}
			} else {
				dragRef.current = hit;
			}
		}
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!dragRef.current) return;
		const p = pctFromEvent(e.clientX, e.clientY);
		if (!p) return;
		onMovePoint(dragRef.current.index, p);
	};

	const handleMouseUp = (e: React.MouseEvent) => {
		if (!dragRef.current) {
			// Tap → add point
			const p = pctFromEvent(e.clientX, e.clientY);
			if (p) onAddPoint(p);
			return;
		}
		dragRef.current = null;
	};

	const draftPointsStr = draftPoints
		.map((p) => `${p.x_pct * 100},${p.y_pct * 100}`)
		.join(" ");

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: custom drawing canvas
		<div
			ref={containerRef}
			className="relative w-full select-none"
			style={{ touchAction: "none", userSelect: "none" }}
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
		>
			<img
				src={imageUrl}
				alt="Topo background"
				className="w-full pointer-events-none"
				draggable={false}
			/>

			{/* SVG renders lines only — no circles, so viewBox scaling doesn't affect dot size */}
			<svg
				className="absolute inset-0 w-full h-full"
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
				aria-hidden="true"
				style={{ pointerEvents: "none" }}
			>
				{/* Saved lines (background, dimmed) */}
				{savedLines.map((line) => (
					<polyline
						key={line.routeId}
						points={line.points
							.map((p) => `${p.x_pct * 100},${p.y_pct * 100}`)
							.join(" ")}
						stroke={line.color}
						strokeWidth="1.5"
						fill="none"
						opacity={0.5}
						strokeLinecap="round"
						strokeLinejoin="round"
						vectorEffect="non-scaling-stroke"
					/>
				))}

				{/* Draft line */}
				{draftPoints.length >= 2 && (
					<polyline
						points={draftPointsStr}
						stroke={activeColor}
						strokeWidth="2"
						fill="none"
						strokeLinecap="round"
						strokeLinejoin="round"
						vectorEffect="non-scaling-stroke"
					/>
				)}
			</svg>

			{/* Midpoint handles — HTML divs so size is true screen pixels */}
			{draftPoints.slice(0, -1).map((pt, i) => {
				const next = draftPoints[i + 1];
				return (
					<div
						key={`mid-${pt.x_pct}-${pt.y_pct}`}
						className="absolute rounded-full pointer-events-none"
						style={{
							width: MID_HANDLE_SIZE,
							height: MID_HANDLE_SIZE,
							left: `${((pt.x_pct + next.x_pct) / 2) * 100}%`,
							top: `${((pt.y_pct + next.y_pct) / 2) * 100}%`,
							transform: "translate(-50%, -50%)",
							backgroundColor: "white",
							border: `1.5px solid ${activeColor}`,
							opacity: 0.8,
						}}
					/>
				);
			})}

			{/* Point handles — HTML divs so size is true screen pixels */}
			{draftPoints.map((pt, i) => (
				<div
					key={`pt-${pt.x_pct}-${pt.y_pct}`}
					className="absolute rounded-full pointer-events-none"
					style={{
						width: HANDLE_SIZE,
						height: HANDLE_SIZE,
						left: `${pt.x_pct * 100}%`,
						top: `${pt.y_pct * 100}%`,
						transform: "translate(-50%, -50%)",
						backgroundColor: i === 0 ? activeColor : "white",
						border: `2px solid ${activeColor}`,
					}}
				/>
			))}
		</div>
	);
};

// ── Wall topo builder ─────────────────────────────────────────────────────────

interface RouteInfo {
	id: string;
	name: string;
	grade: string;
}

interface WallTopoBuilderProps {
	wallId: string;
	routes: RouteInfo[];
	topo: WallTopo | null;
	lines: WallTopoLine[];
	onClose?: () => void;
}

export const WallTopoBuilder = ({
	wallId,
	routes,
	topo,
	lines,
	onClose,
}: WallTopoBuilderProps) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [selectedRouteId, setSelectedRouteId] = useState<string>(
		routes[0]?.id ?? "",
	);
	const [draftPoints, setDraftPoints] = useState<Point[]>([]);
	const [confirmDeleteTopo, setConfirmDeleteTopo] = useState(false);
	const [confirmDeleteLineId, setConfirmDeleteLineId] = useState<string | null>(
		null,
	);

	const uploadImage = useUploadWallTopoImage(wallId);
	const upsertLine = useUpsertWallTopoLine(wallId);
	const deleteLine = useDeleteWallTopoLine(topo?.id ?? "");
	const deleteTopo = useDeleteWallTopo(wallId);

	const selectedRouteIndex = routes.findIndex((r) => r.id === selectedRouteId);
	const activeColor = topoColor(selectedRouteIndex);

	const savedLines = lines
		.filter((l) => l.route_id !== selectedRouteId)
		.map((l) => ({ points: l.points, color: l.color, routeId: l.route_id }));

	const existingLineForRoute = lines.find(
		(l) => l.route_id === selectedRouteId,
	);

	const handleSaveLine = () => {
		if (!topo || draftPoints.length < 2) return;
		upsertLine.mutate(
			{
				topoId: topo.id,
				routeId: selectedRouteId,
				points: draftPoints,
				color: activeColor,
				sortOrder: selectedRouteIndex,
			},
			{ onSuccess: () => setDraftPoints([]) },
		);
	};

	const confirmOverlays = (
		<>
			{confirmDeleteTopo && topo && (
				<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
					<div className="bg-surface-card rounded-t-2xl p-6 w-full flex flex-col gap-3">
						<p className="text-text-primary font-medium text-center">
							Delete topo and all route lines?
						</p>
						<button
							type="button"
							onClick={() => {
								deleteTopo.mutate({ id: topo.id, imageUrl: topo.image_url });
								setConfirmDeleteTopo(false);
								setDraftPoints([]);
								onClose?.();
							}}
							className="w-full py-3 rounded-[var(--radius-md)] bg-red-500 text-white font-medium"
						>
							Delete
						</button>
						<button
							type="button"
							onClick={() => setConfirmDeleteTopo(false)}
							className="w-full py-2 text-text-secondary"
						>
							Cancel
						</button>
					</div>
				</div>
			)}
			{confirmDeleteLineId && (
				<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
					<div className="bg-surface-card rounded-t-2xl p-6 w-full flex flex-col gap-3">
						<p className="text-text-primary font-medium text-center">
							Remove this route line?
						</p>
						<button
							type="button"
							onClick={() => {
								deleteLine.mutate(confirmDeleteLineId);
								setConfirmDeleteLineId(null);
							}}
							className="w-full py-3 rounded-[var(--radius-md)] bg-red-500 text-white font-medium"
						>
							Remove
						</button>
						<button
							type="button"
							onClick={() => setConfirmDeleteLineId(null)}
							className="w-full py-2 text-text-secondary"
						>
							Cancel
						</button>
					</div>
				</div>
			)}
		</>
	);

	// ── No topo image yet ──────────────────────────────────────────────────────

	if (!topo) {
		const uploadContent = (
			<>
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					disabled={uploadImage.isPending}
					className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-border-default p-6 text-text-tertiary disabled:opacity-50"
				>
					{uploadImage.isPending ? <Spinner /> : <span>+ Add topo image</span>}
				</button>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) uploadImage.mutate(file);
						e.target.value = "";
					}}
				/>
			</>
		);

		if (onClose) {
			return (
				<div className="fixed inset-0 z-40 bg-surface-page flex flex-col">
					<div
						className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-subtle"
						style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
					>
						<button
							type="button"
							onClick={onClose}
							className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-raised text-text-primary"
						>
							<X size={18} />
						</button>
						<h2 className="font-display font-semibold text-text-primary">
							Edit Topo
						</h2>
						<div className="w-8" />
					</div>
					<div className="flex-1 flex items-center justify-center px-4">
						<div className="w-full flex flex-col gap-2">{uploadContent}</div>
					</div>
				</div>
			);
		}

		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm font-medium text-text-secondary">Topo</p>
				{uploadContent}
			</div>
		);
	}

	// ── With topo image — modal version ───────────────────────────────────────

	if (onClose) {
		return (
			<div className="fixed inset-0 z-40 bg-surface-page flex flex-col">
				{/* Header */}
				<div
					className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-subtle"
					style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
				>
					<button
						type="button"
						onClick={onClose}
						className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-raised text-text-primary"
					>
						<X size={18} />
					</button>
					<h2 className="font-display font-semibold text-text-primary">
						Edit Topo
					</h2>
					<button
						type="button"
						onClick={() => setConfirmDeleteTopo(true)}
						className="text-xs text-red-400 py-1"
					>
						Delete
					</button>
				</div>

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
					{routes.length > 0 && (
						<div className="flex flex-col gap-1">
							<label
								htmlFor="drawing-for-select-modal"
								className="text-xs text-text-tertiary"
							>
								Drawing for:
							</label>
							<select
								id="drawing-for-select-modal"
								value={selectedRouteId}
								onChange={(e) => {
									setSelectedRouteId(e.target.value);
									setDraftPoints([]);
								}}
								className="text-sm bg-surface-page text-text-primary rounded-[var(--radius-sm)] px-2 py-1 border border-border-default"
							>
								{routes.map((r) => (
									<option key={r.id} value={r.id}>
										{r.name} ({r.grade})
									</option>
								))}
							</select>
							{existingLineForRoute && draftPoints.length === 0 && (
								<div className="flex items-center justify-between text-xs text-text-tertiary">
									<span>Line saved — tap to redraw</span>
									<button
										type="button"
										onClick={() =>
											setConfirmDeleteLineId(existingLineForRoute.id)
										}
										className="text-red-400"
									>
										Remove
									</button>
								</div>
							)}
						</div>
					)}

					<DrawingCanvas
						imageUrl={topo.image_url}
						draftPoints={draftPoints}
						savedLines={savedLines}
						activeColor={activeColor}
						onAddPoint={(p) => setDraftPoints((pts) => [...pts, p])}
						onMovePoint={(index, p) =>
							setDraftPoints((pts) =>
								pts.map((pt, i) => (i === index ? p : pt)),
							)
						}
						onInsertMidpoint={(afterIndex, p) =>
							setDraftPoints((pts) => [
								...pts.slice(0, afterIndex + 1),
								p,
								...pts.slice(afterIndex + 1),
							])
						}
					/>

					{lines.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{lines.map((line) => {
								const route = routes.find((r) => r.id === line.route_id);
								if (!route) return null;
								return (
									<span
										key={line.id}
										className="flex items-center gap-1 text-xs text-text-secondary"
									>
										<span
											className="inline-block w-2.5 h-2.5 rounded-full"
											style={{ backgroundColor: line.color }}
										/>
										{route.name}
									</span>
								);
							})}
						</div>
					)}
				</div>

				{/* Footer — always visible */}
				<div
					className="shrink-0 flex gap-2 px-4 pt-3 border-t border-border-subtle"
					style={{
						paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
					}}
				>
					<button
						type="button"
						onClick={() => setDraftPoints((pts) => pts.slice(0, -1))}
						disabled={draftPoints.length === 0}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-border-default text-text-secondary disabled:opacity-40"
					>
						Undo
					</button>
					<button
						type="button"
						onClick={() => setDraftPoints([])}
						disabled={draftPoints.length === 0}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-border-default text-text-secondary disabled:opacity-40"
					>
						Clear
					</button>
					<button
						type="button"
						disabled={draftPoints.length < 2 || upsertLine.isPending}
						onClick={handleSaveLine}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] bg-accent-primary text-white font-medium disabled:opacity-50"
					>
						{upsertLine.isPending ? <Spinner /> : "Save line"}
					</button>
				</div>

				{confirmOverlays}
			</div>
		);
	}

	// ── With topo image — inline version ──────────────────────────────────────

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<p className="text-sm font-medium text-text-secondary">Topo</p>
				<button
					type="button"
					onClick={() => setConfirmDeleteTopo(true)}
					className="text-xs text-red-400"
				>
					Delete topo
				</button>
			</div>

			{routes.length > 0 && (
				<div className="flex flex-col gap-1">
					<label
						htmlFor="drawing-for-select"
						className="text-xs text-text-tertiary"
					>
						Drawing for:
					</label>
					<select
						id="drawing-for-select"
						value={selectedRouteId}
						onChange={(e) => {
							setSelectedRouteId(e.target.value);
							setDraftPoints([]);
						}}
						className="text-sm bg-surface-page text-text-primary rounded-[var(--radius-sm)] px-2 py-1 border border-border-default"
					>
						{routes.map((r) => (
							<option key={r.id} value={r.id}>
								{r.name} ({r.grade})
							</option>
						))}
					</select>
					{existingLineForRoute && draftPoints.length === 0 && (
						<div className="flex items-center justify-between text-xs text-text-tertiary">
							<span>Line saved — tap to redraw</span>
							<button
								type="button"
								onClick={() => setConfirmDeleteLineId(existingLineForRoute.id)}
								className="text-red-400"
							>
								Remove
							</button>
						</div>
					)}
				</div>
			)}

			<DrawingCanvas
				imageUrl={topo.image_url}
				draftPoints={draftPoints}
				savedLines={savedLines}
				activeColor={activeColor}
				onAddPoint={(p) => setDraftPoints((pts) => [...pts, p])}
				onMovePoint={(index, p) =>
					setDraftPoints((pts) => pts.map((pt, i) => (i === index ? p : pt)))
				}
				onInsertMidpoint={(afterIndex, p) =>
					setDraftPoints((pts) => [
						...pts.slice(0, afterIndex + 1),
						p,
						...pts.slice(afterIndex + 1),
					])
				}
			/>

			{draftPoints.length > 0 && (
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => setDraftPoints((pts) => pts.slice(0, -1))}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-border-default text-text-secondary"
					>
						Undo
					</button>
					<button
						type="button"
						onClick={() => setDraftPoints([])}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-border-default text-text-secondary"
					>
						Clear
					</button>
					<button
						type="button"
						disabled={draftPoints.length < 2 || upsertLine.isPending}
						onClick={handleSaveLine}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] bg-accent-primary text-white font-medium disabled:opacity-50"
					>
						{upsertLine.isPending ? <Spinner /> : "Save line"}
					</button>
				</div>
			)}

			{lines.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{lines.map((line) => {
						const route = routes.find((r) => r.id === line.route_id);
						if (!route) return null;
						return (
							<span
								key={line.id}
								className="flex items-center gap-1 text-xs text-text-secondary"
							>
								<span
									className="inline-block w-2.5 h-2.5 rounded-full"
									style={{ backgroundColor: line.color }}
								/>
								{route.name}
							</span>
						);
					})}
				</div>
			)}

			{confirmOverlays}
		</div>
	);
};

// ── Route topo builder ────────────────────────────────────────────────────────

interface RouteTopoBuilderProps {
	routeId: string;
	topo: RouteTopo | null;
	onClose?: () => void;
}

export const RouteTopoBuilder = ({
	routeId,
	topo,
	onClose,
}: RouteTopoBuilderProps) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [draftPoints, setDraftPoints] = useState<Point[]>(topo?.points ?? []);
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [selectedColor, setSelectedColor] = useState<string>(
		topo?.color ?? LINE_COLORS[0],
	);

	const upsertTopo = useUpsertRouteTopo(routeId);
	const deleteTopo = useDeleteRouteTopo(routeId);

	const imageUrl = previewUrl ?? topo?.image_url ?? null;
	const color = selectedColor;

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setPendingFile(file);
		setPreviewUrl(URL.createObjectURL(file));
		setDraftPoints([]);
		e.target.value = "";
	};

	const handleSave = () => {
		upsertTopo.mutate(
			{ file: pendingFile, points: draftPoints, color },
			{
				onSuccess: () => {
					setPendingFile(null);
					if (previewUrl) URL.revokeObjectURL(previewUrl);
					setPreviewUrl(null);
				},
			},
		);
	};

	const isDirty =
		pendingFile !== null ||
		JSON.stringify(draftPoints) !== JSON.stringify(topo?.points ?? []) ||
		selectedColor !== (topo?.color ?? LINE_COLORS[0]);

	const confirmDeleteOverlay = confirmDelete && topo && (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
			<div className="bg-surface-card rounded-t-2xl p-6 w-full flex flex-col gap-3">
				<p className="text-text-primary font-medium text-center">
					Delete this route topo?
				</p>
				<button
					type="button"
					onClick={() => {
						deleteTopo.mutate({ id: topo.id, imageUrl: topo.image_url });
						setConfirmDelete(false);
						setDraftPoints([]);
						onClose?.();
					}}
					className="w-full py-3 rounded-[var(--radius-md)] bg-red-500 text-white font-medium"
				>
					Delete
				</button>
				<button
					type="button"
					onClick={() => setConfirmDelete(false)}
					className="w-full py-2 text-text-secondary"
				>
					Cancel
				</button>
			</div>
		</div>
	);

	// ── No image yet ───────────────────────────────────────────────────────────

	if (!imageUrl) {
		const uploadContent = (
			<>
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-border-default p-6 text-text-tertiary"
				>
					+ Add topo image
				</button>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={handleFileChange}
				/>
			</>
		);

		if (onClose) {
			return (
				<div className="fixed inset-0 z-40 bg-surface-page flex flex-col">
					<div
						className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-subtle"
						style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
					>
						<button
							type="button"
							onClick={onClose}
							className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-raised text-text-primary"
						>
							<X size={18} />
						</button>
						<h2 className="font-display font-semibold text-text-primary">
							Edit Topo
						</h2>
						<div className="w-8" />
					</div>
					<div className="flex-1 flex items-center justify-center px-4">
						<div className="w-full flex flex-col gap-2">{uploadContent}</div>
					</div>
				</div>
			);
		}

		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm font-medium text-text-secondary">Route topo</p>
				{uploadContent}
			</div>
		);
	}

	// ── With image — modal version ─────────────────────────────────────────────

	if (onClose) {
		return (
			<div className="fixed inset-0 z-40 bg-surface-page flex flex-col">
				{/* Header */}
				<div
					className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border-subtle"
					style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
				>
					<button
						type="button"
						onClick={onClose}
						className="flex items-center justify-center w-8 h-8 rounded-full bg-surface-raised text-text-primary"
					>
						<X size={18} />
					</button>
					<h2 className="font-display font-semibold text-text-primary">
						Edit Topo
					</h2>
					<div className="flex gap-3 items-center">
						<button
							type="button"
							onClick={() => fileInputRef.current?.click()}
							className="text-xs text-accent-primary py-1"
						>
							Change
						</button>
						{topo && (
							<button
								type="button"
								onClick={() => setConfirmDelete(true)}
								className="text-xs text-red-400 py-1"
							>
								Delete
							</button>
						)}
					</div>
				</div>

				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={handleFileChange}
				/>

				{/* Body */}
				<div className="flex-1 overflow-y-auto">
					<DrawingCanvas
						imageUrl={imageUrl}
						draftPoints={draftPoints}
						savedLines={[]}
						activeColor={color}
						onAddPoint={(p) => setDraftPoints((pts) => [...pts, p])}
						onMovePoint={(index, p) =>
							setDraftPoints((pts) =>
								pts.map((pt, i) => (i === index ? p : pt)),
							)
						}
						onInsertMidpoint={(afterIndex, p) =>
							setDraftPoints((pts) => [
								...pts.slice(0, afterIndex + 1),
								p,
								...pts.slice(afterIndex + 1),
							])
						}
					/>
				</div>

				{/* Color picker */}
				<div className="shrink-0 flex items-center gap-3 px-4 py-3 border-t border-border-subtle bg-surface-raised">
					<span className="text-xs text-text-tertiary shrink-0">Color</span>
					<ColorPicker value={color} onChange={setSelectedColor} />
				</div>

				{/* Footer — always visible */}
				<div
					className="shrink-0 flex gap-2 px-4 pt-3 border-t border-border-subtle"
					style={{
						paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
					}}
				>
					<button
						type="button"
						onClick={() => setDraftPoints((pts) => pts.slice(0, -1))}
						disabled={draftPoints.length === 0}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-border-default text-text-secondary disabled:opacity-40"
					>
						Undo
					</button>
					<button
						type="button"
						onClick={() => setDraftPoints([])}
						disabled={draftPoints.length === 0}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-border-default text-text-secondary disabled:opacity-40"
					>
						Clear
					</button>
					<button
						type="button"
						disabled={
							!isDirty || draftPoints.length < 2 || upsertTopo.isPending
						}
						onClick={handleSave}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] bg-accent-primary text-white font-medium disabled:opacity-50"
					>
						{upsertTopo.isPending ? <Spinner /> : "Save topo"}
					</button>
				</div>

				{confirmDeleteOverlay}
			</div>
		);
	}

	// ── With image — inline version ────────────────────────────────────────────

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<p className="text-sm font-medium text-text-secondary">Route topo</p>
				<div className="flex gap-3">
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="text-xs text-accent-primary"
					>
						Change image
					</button>
					{topo && (
						<button
							type="button"
							onClick={() => setConfirmDelete(true)}
							className="text-xs text-red-400"
						>
							Delete
						</button>
					)}
				</div>
			</div>

			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={handleFileChange}
			/>

			<DrawingCanvas
				imageUrl={imageUrl}
				draftPoints={draftPoints}
				savedLines={[]}
				activeColor={color}
				onAddPoint={(p) => setDraftPoints((pts) => [...pts, p])}
				onMovePoint={(index, p) =>
					setDraftPoints((pts) => pts.map((pt, i) => (i === index ? p : pt)))
				}
				onInsertMidpoint={(afterIndex, p) =>
					setDraftPoints((pts) => [
						...pts.slice(0, afterIndex + 1),
						p,
						...pts.slice(afterIndex + 1),
					])
				}
			/>

			{draftPoints.length > 0 && (
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => setDraftPoints((pts) => pts.slice(0, -1))}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-border-default text-text-secondary"
					>
						Undo
					</button>
					<button
						type="button"
						onClick={() => setDraftPoints([])}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-border-default text-text-secondary"
					>
						Clear
					</button>
				</div>
			)}

			{isDirty && (
				<button
					type="button"
					disabled={upsertTopo.isPending || draftPoints.length < 2}
					onClick={handleSave}
					className="w-full py-2.5 text-sm rounded-[var(--radius-md)] bg-accent-primary text-white font-medium disabled:opacity-50"
				>
					{upsertTopo.isPending ? <Spinner /> : "Save topo"}
				</button>
			)}

			{confirmDeleteOverlay}
		</div>
	);
};
