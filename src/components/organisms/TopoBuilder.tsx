import { X } from "lucide-react";
import { useRef, useState } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import { ConfirmDeleteDialog } from "@/components/molecules/ConfirmDeleteDialog";
import { ImagePickerGrid } from "@/components/molecules/ImagePickerGrid";
import { Sheet } from "@/components/molecules/Sheet";
import {
	useDeleteRouteTopo,
	useDeleteWallTopo,
	useDeleteWallTopoLine,
	useSetWallTopoFromUrl,
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
	/** Called once when a handle drag begins — use to snapshot history */
	onDragStart?: () => void;
}

const DrawingCanvas = ({
	imageUrl,
	draftPoints,
	savedLines,
	activeColor,
	onAddPoint,
	onMovePoint,
	onInsertMidpoint,
	onDragStart,
}: DrawingCanvasProps) => {
	const containerRef = useRef<HTMLDivElement>(null);
	// Track which handle is being dragged: { type: 'point' | 'mid', index }
	const dragRef = useRef<{ type: "point" | "mid"; index: number } | null>(null);
	const dragStartedRef = useRef(false); // whether onDragStart has fired for this drag

	// Pinch-zoom and pan state (zoom always scales from image center)
	const [zoom, setZoom] = useState(1);
	const [pan, setPan] = useState({ x: 0, y: 0 });
	const pinchRef = useRef<{
		dist: number;
		startZoom: number;
	} | null>(null);
	// Tracks the anchor point when a single-finger pan gesture starts
	const panAnchorRef = useRef<{
		touchX: number;
		touchY: number;
		panX: number;
		panY: number;
	} | null>(null);

	// Double-tap detection for zoom reset
	const lastTapRef = useRef(0);

	// Longpress detection for waypoint addition
	const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
	const LONG_PRESS_MS = 500;
	const PAN_THRESHOLD = 8; // px — movement beyond this cancels longpress
	// Blocks synthetic mouse events that Android WebView fires after touch events
	const lastTouchEndRef = useRef(0);

	const clampPan = (px: number, py: number, z: number) => {
		const el = containerRef.current;
		if (!el) return { x: px, y: py };
		const maxX = (el.offsetWidth / 2) * (z - 1);
		const maxY = (el.offsetHeight / 2) * (z - 1);
		return {
			x: Math.max(-maxX, Math.min(maxX, px)),
			y: Math.max(-maxY, Math.min(maxY, py)),
		};
	};

	const pctFromEvent = (clientX: number, clientY: number): Point | null => {
		const el = containerRef.current;
		if (!el) return null;
		// getBoundingClientRect accounts for the CSS transform (zoom/pan)
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
		// Two-finger pinch: start tracking
		if (e.touches.length === 2) {
			e.preventDefault();
			// Cancel any pending longpress when a second finger arrives
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = null;
				touchStartPosRef.current = null;
			}
			dragRef.current = null;
			const t1 = e.touches[0];
			const t2 = e.touches[1];
			const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
			pinchRef.current = { dist, startZoom: zoom };
			return;
		}

		if (e.touches.length !== 1) return;
		const touch = e.touches[0];
		const hit = nearestHandle(touch.clientX, touch.clientY);
		if (hit) {
			e.preventDefault();
			// Cancel longpress — user is dragging a handle
			if (longPressTimerRef.current) {
				clearTimeout(longPressTimerRef.current);
				longPressTimerRef.current = null;
				touchStartPosRef.current = null;
			}
			if (hit.type === "mid") {
				// Insert the point immediately so dragging tracks the finger live
				const p = pctFromEvent(touch.clientX, touch.clientY);
				if (p) {
					onInsertMidpoint(hit.index, p);
					dragRef.current = { type: "point", index: hit.index + 1 };
					dragStartedRef.current = false;
				}
			} else {
				dragRef.current = hit;
				dragStartedRef.current = false;
			}
		} else {
			// No handle hit — start longpress timer to add a new point.
			// preventDefault suppresses synthetic mouse events on Android WebView
			// so handleMouseUp won't fire and add a point immediately.
			e.preventDefault();
			if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
			touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
			longPressTimerRef.current = setTimeout(() => {
				if (!dragRef.current && !pinchRef.current && touchStartPosRef.current) {
					const p = pctFromEvent(
						touchStartPosRef.current.x,
						touchStartPosRef.current.y,
					);
					if (p) onAddPoint(p);
				}
				longPressTimerRef.current = null;
			}, LONG_PRESS_MS);
		}
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		// Two-finger pinch: update zoom (always centered on image center)
		// Note: no e.preventDefault() here — React attaches touch listeners as passive,
		// so preventDefault() would throw. touchAction:"none" on the outer wrapper
		// already prevents the browser's default scroll/zoom behavior.
		if (e.touches.length === 2 && pinchRef.current) {
			const t1 = e.touches[0];
			const t2 = e.touches[1];
			const newDist = Math.hypot(
				t2.clientX - t1.clientX,
				t2.clientY - t1.clientY,
			);
			const scale = newDist / pinchRef.current.dist;
			const newZoom = Math.max(
				1,
				Math.min(5, pinchRef.current.startZoom * scale),
			);
			setZoom(newZoom);
			if (newZoom <= 1) {
				setPan({ x: 0, y: 0 });
			} else {
				setPan((prev) => clampPan(prev.x, prev.y, newZoom));
			}
			return;
		}

		// Single finger moving
		if (e.touches.length === 1 && !dragRef.current) {
			const t = e.touches[0];
			// If longpress is pending and finger moved beyond threshold, cancel it
			// and start a pan gesture anchored at the current position
			if (longPressTimerRef.current && touchStartPosRef.current) {
				const dx = Math.abs(t.clientX - touchStartPosRef.current.x);
				const dy = Math.abs(t.clientY - touchStartPosRef.current.y);
				if (dx > PAN_THRESHOLD || dy > PAN_THRESHOLD) {
					clearTimeout(longPressTimerRef.current);
					longPressTimerRef.current = null;
					touchStartPosRef.current = null;
					// Only start panning when zoomed in; at zoom=1 there's nothing to pan
					if (zoom > 1) {
						panAnchorRef.current = {
							touchX: t.clientX,
							touchY: t.clientY,
							panX: pan.x,
							panY: pan.y,
						};
					}
				}
			}
			// Continue panning if anchor is set
			if (panAnchorRef.current) {
				setPan(
					clampPan(
						panAnchorRef.current.panX +
							(t.clientX - panAnchorRef.current.touchX),
						panAnchorRef.current.panY +
							(t.clientY - panAnchorRef.current.touchY),
						zoom,
					),
				);
			}
			return;
		}

		if (!dragRef.current || e.touches.length !== 1) return;
		e.preventDefault();
		const touch = e.touches[0];
		const p = pctFromEvent(touch.clientX, touch.clientY);
		if (!p) return;
		if (!dragStartedRef.current) {
			onDragStart?.();
			dragStartedRef.current = true;
		}
		onMovePoint(dragRef.current.index, p);
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		// Always cancel any pending longpress on finger lift
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
		touchStartPosRef.current = null;
		panAnchorRef.current = null;
		lastTouchEndRef.current = Date.now();

		if (pinchRef.current && e.touches.length < 2) {
			pinchRef.current = null;
			return;
		}

		if (dragRef.current) {
			dragRef.current = null;
			dragStartedRef.current = false;
			return;
		}

		if (e.changedTouches.length !== 1) return;
		const now = Date.now();

		// Double-tap to reset zoom and pan
		if (now - lastTapRef.current < 300) {
			setZoom(1);
			setPan({ x: 0, y: 0 });
			lastTapRef.current = 0;
			return;
		}
		lastTapRef.current = now;
		// Points are added via longpress timer — nothing else to do on tap end
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		// Ignore synthetic mouse events fired by Android WebView after touch
		if (Date.now() - lastTouchEndRef.current < 500) return;
		const hit = nearestHandle(e.clientX, e.clientY);
		if (hit) {
			if (hit.type === "mid") {
				// Insert the point immediately so dragging tracks the cursor live
				const p = pctFromEvent(e.clientX, e.clientY);
				if (p) {
					onInsertMidpoint(hit.index, p);
					dragRef.current = { type: "point", index: hit.index + 1 };
					dragStartedRef.current = false;
				}
			} else {
				dragRef.current = hit;
				dragStartedRef.current = false;
			}
		}
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!dragRef.current) return;
		const p = pctFromEvent(e.clientX, e.clientY);
		if (!p) return;
		if (!dragStartedRef.current) {
			onDragStart?.();
			dragStartedRef.current = true;
		}
		onMovePoint(dragRef.current.index, p);
	};

	const handleMouseUp = (e: React.MouseEvent) => {
		// Ignore synthetic mouse events fired by Android WebView after touch
		if (Date.now() - lastTouchEndRef.current < 500) return;
		if (!dragRef.current) {
			// Mouse click → add point immediately (desktop only; touch uses longpress)
			const p = pctFromEvent(e.clientX, e.clientY);
			if (p) onAddPoint(p);
			return;
		}
		dragRef.current = null;
		dragStartedRef.current = false;
	};

	const draftPointsStr = draftPoints
		.map((p) => `${p.x_pct * 100},${p.y_pct * 100}`)
		.join(" ");

	return (
		// Outer wrapper clips overflow when zoomed
		<div
			className="relative w-full overflow-hidden select-none"
			style={{ touchAction: "none", userSelect: "none" }}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: custom drawing canvas */}
			<div
				ref={containerRef}
				className="relative w-full"
				style={{
					transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
					transformOrigin: "center",
				}}
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
							strokeWidth="4"
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
		</div>
	);
};

// ── Wall topo builder ─────────────────────────────────────────────────────────

type RouteType = "sport" | "boulder" | "trad";

interface RouteInfo {
	id: string;
	name: string;
	grade: string;
	route_type: RouteType;
}

interface GalleryImage {
	id: string;
	image_url: string;
}

interface WallTopoBuilderProps {
	wallId: string;
	routes: RouteInfo[];
	topo: WallTopo | null;
	lines: WallTopoLine[];
	galleryImages?: GalleryImage[];
	onClose?: () => void;
}

export const WallTopoBuilder = ({
	wallId,
	routes,
	topo,
	lines,
	galleryImages = [],
	onClose,
}: WallTopoBuilderProps) => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [selectedRouteId, setSelectedRouteId] = useState<string>(
		routes[0]?.id ?? "",
	);

	// Load existing points for the initially selected route
	const [draftPoints, setDraftPoints] = useState<Point[]>(() => {
		const existing = lines.find((l) => l.route_id === routes[0]?.id);
		return existing?.points ?? [];
	});

	// Per-route colors: seed from existing lines, fall back to topoColor palette
	const [routeColors, setRouteColors] = useState<Record<string, string>>(() => {
		const map: Record<string, string> = {};
		routes.forEach((r, i) => {
			const existingLine = lines.find((l) => l.route_id === r.id);
			map[r.id] = existingLine?.color ?? topoColor(i);
		});
		return map;
	});

	// Undo history — ref so it doesn't trigger re-renders on drag frames
	const historyRef = useRef<Point[][]>([]);

	const [confirmDeleteTopo, setConfirmDeleteTopo] = useState(false);
	const [confirmDeleteLineId, setConfirmDeleteLineId] = useState<string | null>(
		null,
	);
	const [showImagePicker, setShowImagePicker] = useState(false);

	const uploadImage = useUploadWallTopoImage(wallId);
	const setTopoFromUrl = useSetWallTopoFromUrl(wallId);
	const upsertLine = useUpsertWallTopoLine(wallId);
	const deleteLine = useDeleteWallTopoLine(topo?.id ?? "");
	const deleteTopo = useDeleteWallTopo(wallId);

	const selectedRouteIndex = routes.findIndex((r) => r.id === selectedRouteId);
	const activeColor =
		routeColors[selectedRouteId] ?? topoColor(selectedRouteIndex);

	const savedLines = lines
		.filter((l) => l.route_id !== selectedRouteId)
		.map((l) => ({ points: l.points, color: l.color, routeId: l.route_id }));

	const existingLineForRoute = lines.find(
		(l) => l.route_id === selectedRouteId,
	);

	const handleRouteSwitch = (newId: string) => {
		setSelectedRouteId(newId);
		const existing = lines.find((l) => l.route_id === newId);
		setDraftPoints(existing?.points ?? []);
		historyRef.current = [];
	};

	const handleSaveLine = () => {
		if (!topo || draftPoints.length < 2) return;
		upsertLine.mutate({
			topoId: topo.id,
			routeId: selectedRouteId,
			points: draftPoints,
			color: activeColor,
			sortOrder: selectedRouteIndex,
		});
	};

	const handleUndo = () => {
		if (historyRef.current.length === 0) return;
		const prev = historyRef.current[historyRef.current.length - 1];
		historyRef.current = historyRef.current.slice(0, -1);
		setDraftPoints(prev);
	};

	const pendingDeleteLineName =
		routes.find(
			(r) => r.id === lines.find((l) => l.id === confirmDeleteLineId)?.route_id,
		)?.name ?? "";

	const confirmOverlays = (
		<>
			<ConfirmDeleteDialog
				isOpen={confirmDeleteTopo && topo !== null}
				title="Delete topo"
				message="Delete this topo and all route lines? This can't be undone."
				onConfirm={() => {
					if (topo)
						deleteTopo.mutate({ id: topo.id, imageUrl: topo.image_url });
					setConfirmDeleteTopo(false);
					setDraftPoints([]);
					onClose?.();
				}}
				onCancel={() => setConfirmDeleteTopo(false)}
			/>
			<ConfirmDeleteDialog
				isOpen={confirmDeleteLineId !== null}
				title="Remove route line"
				message={`Remove the line for "${pendingDeleteLineName}"?`}
				onConfirm={() => {
					if (confirmDeleteLineId) deleteLine.mutate(confirmDeleteLineId);
					setConfirmDeleteLineId(null);
				}}
				onCancel={() => setConfirmDeleteLineId(null)}
			/>
		</>
	);

	// ── No topo image yet ──────────────────────────────────────────────────────

	if (!topo) {
		const uploadContent = (
			<>
				<ImagePickerGrid
					images={galleryImages}
					onSelect={(url) => setTopoFromUrl.mutate(url)}
					onUpload={() => fileInputRef.current?.click()}
					isUploading={uploadImage.isPending || setTopoFromUrl.isPending}
				/>
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
				<div className="fixed inset-0 z-40 bg-cyan-900 flex flex-col">
					<div
						className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/20"
						style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
					>
						<button
							type="button"
							onClick={onClose}
							className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white"
						>
							<X size={18} />
						</button>
						<h2 className="font-display font-semibold text-white">
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

	// Shared route selector + color picker UI (used in both modal and inline)
	const routeControls = routes.length > 0 && (
		<div className="flex flex-col gap-2">
			<div className="flex flex-col gap-1">
				<label
					htmlFor="drawing-for-select"
					className="text-xs text-white/50"
				>
					Drawing for:
				</label>
				<select
					id="drawing-for-select"
					value={selectedRouteId}
					onChange={(e) => handleRouteSwitch(e.target.value)}
					className="text-sm bg-surface-stone text-text-on-light rounded-[var(--radius-sm)] px-2 py-1 border border-border-input"
				>
					{routes.map((r) => (
						<option key={r.id} value={r.id}>
							{r.name} (
							{r.route_type === "sport"
								? "S"
								: r.route_type === "boulder"
									? "B"
									: "T"}{" "}
							· {r.grade})
						</option>
					))}
				</select>
				{existingLineForRoute && draftPoints.length === 0 && (
					<div className="flex items-center justify-between text-xs text-white/50">
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
			<div className="flex items-center gap-2">
				<span className="text-xs text-white/50 shrink-0">Color</span>
				<ColorPicker
					value={activeColor}
					onChange={(c) =>
						setRouteColors((prev) => ({ ...prev, [selectedRouteId]: c }))
					}
				/>
			</div>
		</div>
	);

	// Shared footer buttons
	const footerButtons = (
		<>
			<button
				type="button"
				onClick={handleUndo}
				disabled={historyRef.current.length === 0 && draftPoints.length === 0}
				className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-white/30 text-white disabled:opacity-40"
			>
				Undo
			</button>
			<button
				type="button"
				onClick={() => {
					historyRef.current = [];
					setDraftPoints([]);
				}}
				disabled={draftPoints.length === 0}
				className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-white/30 text-white disabled:opacity-40"
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
		</>
	);

	const drawingCanvas = (
		<DrawingCanvas
			imageUrl={topo.image_url}
			draftPoints={draftPoints}
			savedLines={savedLines}
			activeColor={activeColor}
			onDragStart={() => {
				historyRef.current = [...historyRef.current, draftPoints];
			}}
			onAddPoint={(p) => {
				historyRef.current = [...historyRef.current, draftPoints];
				setDraftPoints((pts) => [...pts, p]);
			}}
			onMovePoint={(index, p) =>
				setDraftPoints((pts) => pts.map((pt, i) => (i === index ? p : pt)))
			}
			onInsertMidpoint={(afterIndex, p) => {
				historyRef.current = [...historyRef.current, draftPoints];
				setDraftPoints((pts) => [
					...pts.slice(0, afterIndex + 1),
					p,
					...pts.slice(afterIndex + 1),
				]);
			}}
		/>
	);

	// ── With topo image — modal version ───────────────────────────────────────

	if (onClose) {
		return (
			<div className="fixed inset-0 z-40 bg-cyan-900 flex flex-col">
				{/* Header */}
				<div
					className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/20"
					style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
				>
					<button
						type="button"
						onClick={onClose}
						className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white"
					>
						<X size={18} />
					</button>
					<h2 className="font-display font-semibold text-white">
						Edit Topo
					</h2>
					<div className="flex gap-3 items-center">
						<button
							type="button"
							onClick={() => setShowImagePicker(true)}
							className="text-xs text-text-light-on-dark-secondary hover:text-text-on-dark py-1"
						>
							Change
						</button>
						<button
							type="button"
							onClick={() => setConfirmDeleteTopo(true)}
							className="text-xs text-red-400 py-1"
						>
							Delete
						</button>
					</div>
				</div>

				<Sheet
					isOpen={showImagePicker}
					onClose={() => setShowImagePicker(false)}
					title="Choose Image"
				>
					<ImagePickerGrid
						images={galleryImages}
						onSelect={(url) => {
							setTopoFromUrl.mutate(url);
							setShowImagePicker(false);
						}}
						onUpload={() => {
							setShowImagePicker(false);
							fileInputRef.current?.click();
						}}
						isUploading={uploadImage.isPending || setTopoFromUrl.isPending}
					/>
				</Sheet>
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

				{/* Body */}
				<div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
					{routeControls}
					{drawingCanvas}

					{lines.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{lines.map((line) => {
								const route = routes.find((r) => r.id === line.route_id);
								if (!route) return null;
								return (
									<span
										key={line.id}
										className="flex items-center gap-1 text-xs text-white/70"
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
					className="shrink-0 flex gap-2 px-4 pt-3 border-t border-white/20"
					style={{
						paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
					}}
				>
					{footerButtons}
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
				<div className="flex gap-3">
					<button
						type="button"
						onClick={() => setShowImagePicker(true)}
						className="text-xs text-accent-primary"
					>
						Change image
					</button>
					<button
						type="button"
						onClick={() => setConfirmDeleteTopo(true)}
						className="text-xs text-red-400"
					>
						Delete topo
					</button>
				</div>
			</div>

			<Sheet
				isOpen={showImagePicker}
				onClose={() => setShowImagePicker(false)}
				title="Choose Image"
			>
				<ImagePickerGrid
					images={galleryImages}
					onSelect={(url) => {
						setTopoFromUrl.mutate(url);
						setShowImagePicker(false);
					}}
					onUpload={() => {
						setShowImagePicker(false);
						fileInputRef.current?.click();
					}}
					isUploading={uploadImage.isPending || setTopoFromUrl.isPending}
				/>
			</Sheet>
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

			{routeControls}
			{drawingCanvas}

			{draftPoints.length > 0 && (
				<div className="flex gap-2">{footerButtons}</div>
			)}

			{lines.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{lines.map((line) => {
						const route = routes.find((r) => r.id === line.route_id);
						if (!route) return null;
						return (
							<span
								key={line.id}
								className="flex items-center gap-1 text-xs text-white/70"
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
	galleryImages?: GalleryImage[];
	onClose?: () => void;
}

export const RouteTopoBuilder = ({
	routeId,
	topo,
	galleryImages = [],
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
	const [galleryImageUrl, setGalleryImageUrl] = useState<string | null>(null);
	const [showImagePicker, setShowImagePicker] = useState(false);

	const historyRef = useRef<Point[][]>([]);

	const upsertTopo = useUpsertRouteTopo(routeId);
	const deleteTopo = useDeleteRouteTopo(routeId);

	const imageUrl = previewUrl ?? topo?.image_url ?? null;
	const color = selectedColor;

	const handleSelectGalleryImage = (url: string) => {
		setGalleryImageUrl(url);
		setPendingFile(null);
		setPreviewUrl(url);
		setDraftPoints([]);
		historyRef.current = [];
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setPendingFile(file);
		setGalleryImageUrl(null);
		setPreviewUrl(URL.createObjectURL(file));
		setDraftPoints([]);
		historyRef.current = [];
		e.target.value = "";
	};

	const handleSave = () => {
		upsertTopo.mutate(
			{
				file: pendingFile,
				imageUrl: galleryImageUrl ?? undefined,
				points: draftPoints,
				color,
			},
			{
				onSuccess: () => {
					setPendingFile(null);
					if (previewUrl) URL.revokeObjectURL(previewUrl);
					setPreviewUrl(null);
				},
			},
		);
	};

	const handleUndo = () => {
		if (historyRef.current.length === 0) return;
		const prev = historyRef.current[historyRef.current.length - 1];
		historyRef.current = historyRef.current.slice(0, -1);
		setDraftPoints(prev);
	};

	const isDirty =
		pendingFile !== null ||
		galleryImageUrl !== null ||
		JSON.stringify(draftPoints) !== JSON.stringify(topo?.points ?? []) ||
		selectedColor !== (topo?.color ?? LINE_COLORS[0]);

	const confirmDeleteOverlay = (
		<ConfirmDeleteDialog
			isOpen={confirmDelete && topo !== null}
			title="Delete topo"
			message="Delete this route topo? This can't be undone."
			onConfirm={() => {
				if (topo) deleteTopo.mutate({ id: topo.id, imageUrl: topo.image_url });
				setConfirmDelete(false);
				setDraftPoints([]);
				onClose?.();
			}}
			onCancel={() => setConfirmDelete(false)}
		/>
	);

	const drawingCanvas = imageUrl && (
		<DrawingCanvas
			imageUrl={imageUrl}
			draftPoints={draftPoints}
			savedLines={[]}
			activeColor={color}
			onDragStart={() => {
				historyRef.current = [...historyRef.current, draftPoints];
			}}
			onAddPoint={(p) => {
				historyRef.current = [...historyRef.current, draftPoints];
				setDraftPoints((pts) => [...pts, p]);
			}}
			onMovePoint={(index, p) =>
				setDraftPoints((pts) => pts.map((pt, i) => (i === index ? p : pt)))
			}
			onInsertMidpoint={(afterIndex, p) => {
				historyRef.current = [...historyRef.current, draftPoints];
				setDraftPoints((pts) => [
					...pts.slice(0, afterIndex + 1),
					p,
					...pts.slice(afterIndex + 1),
				]);
			}}
		/>
	);

	// ── No image yet ───────────────────────────────────────────────────────────

	if (!imageUrl) {
		const uploadContent = (
			<>
				<ImagePickerGrid
					images={galleryImages}
					onSelect={(url) => handleSelectGalleryImage(url)}
					onUpload={() => fileInputRef.current?.click()}
				/>
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
				<div className="fixed inset-0 z-40 bg-cyan-900 flex flex-col">
					<div
						className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/20"
						style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
					>
						<button
							type="button"
							onClick={onClose}
							className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white"
						>
							<X size={18} />
						</button>
						<h2 className="font-display font-semibold text-white">
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
			<div className="fixed inset-0 z-40 bg-cyan-900 flex flex-col">
				{/* Header */}
				<div
					className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/20"
					style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
				>
					<button
						type="button"
						onClick={onClose}
						className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white"
					>
						<X size={18} />
					</button>
					<h2 className="font-display font-semibold text-white">
						Edit Topo
					</h2>
					<div className="flex gap-3 items-center">
						<button
							type="button"
							onClick={() => setShowImagePicker(true)}
							className="text-xs text-text-light-on-dark-secondary hover:text-text-on-dark py-1"
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

				<Sheet
					isOpen={showImagePicker}
					onClose={() => setShowImagePicker(false)}
					title="Choose Image"
				>
					<ImagePickerGrid
						images={galleryImages}
						onSelect={(url) => {
							handleSelectGalleryImage(url);
							setShowImagePicker(false);
						}}
						onUpload={() => {
							setShowImagePicker(false);
							fileInputRef.current?.click();
						}}
					/>
				</Sheet>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={handleFileChange}
				/>

				{/* Body */}
				<div className="flex-1 overflow-y-auto">{drawingCanvas}</div>

				{/* Color picker */}
				<div className="shrink-0 flex items-center gap-3 px-4 py-3 border-t border-white/20 bg-cyan-800/50">
					<span className="text-xs text-white/50 shrink-0">Color</span>
					<ColorPicker value={color} onChange={setSelectedColor} />
				</div>

				{/* Footer — always visible */}
				<div
					className="shrink-0 flex gap-2 px-4 pt-3 border-t border-white/20"
					style={{
						paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
					}}
				>
					<button
						type="button"
						onClick={handleUndo}
						disabled={historyRef.current.length === 0}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-white/30 text-white disabled:opacity-40"
					>
						Undo
					</button>
					<button
						type="button"
						onClick={() => {
							historyRef.current = [];
							setDraftPoints([]);
						}}
						disabled={draftPoints.length === 0}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-white/30 text-white disabled:opacity-40"
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
						onClick={() => setShowImagePicker(true)}
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

			<Sheet
				isOpen={showImagePicker}
				onClose={() => setShowImagePicker(false)}
				title="Choose Image"
			>
				<ImagePickerGrid
					images={galleryImages}
					onSelect={(url) => {
						handleSelectGalleryImage(url);
						setShowImagePicker(false);
					}}
					onUpload={() => {
						setShowImagePicker(false);
						fileInputRef.current?.click();
					}}
				/>
			</Sheet>
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={handleFileChange}
			/>

			{drawingCanvas}

			{draftPoints.length > 0 && (
				<div className="flex gap-2">
					<button
						type="button"
						onClick={handleUndo}
						disabled={historyRef.current.length === 0}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-white/30 text-white disabled:opacity-40"
					>
						Undo
					</button>
					<button
						type="button"
						onClick={() => {
							historyRef.current = [];
							setDraftPoints([]);
						}}
						className="flex-1 py-2 text-sm rounded-[var(--radius-md)] border border-white/30 text-white"
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
