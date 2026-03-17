import {
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	ChevronLeft,
	ChevronRight,
	HandGrab,
	Pencil,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FootIcon } from "@/components/atoms/FootIcon";
import { Input } from "@/components/atoms/Input";
import {
	useAddPin,
	useClimbImagePins,
	useDeletePin,
	useUpdatePin,
} from "@/features/climb-images/climb-images.queries";
import type {
	ClimbImageWithUrl,
	PinType,
	PointerDir,
} from "@/features/climb-images/climb-images.schema";

// ── Pin type config ───────────────────────────────────────────────────────────

const PIN_CONFIG: Record<
	PinType,
	{ label: string; color: string; mirror?: boolean }
> = {
	lh: { label: "LH", color: "#3b82f6", mirror: true },
	rh: { label: "RH", color: "#ef4444" },
	lf: { label: "LF", color: "#22c55e" },
	rf: { label: "RF", color: "#f59e0b", mirror: true },
};

const PIN_CIRCLE = 20; // diameter of the circle head
const PIN_TIP = 8; // height/width of the triangle tip
const PIN_R = PIN_CIRCLE / 2; // radius
const DRAG_Y_OFFSET = 35; // px — shifts pin below finger during drag so it's visible

const MAGNIFIER_SIZE = 80; // px — canvas width & height
const MAGNIFIER_ZOOM = 2.5; // zoom multiplier
const MAGNIFIER_GAP = 60; // px — gap between magnifier bottom edge and raw touch point

// ── Pin geometry helpers ──────────────────────────────────────────────────────

function pinPosition(
	xPct: number,
	yPct: number,
	dir: PointerDir,
): React.CSSProperties {
	switch (dir) {
		case "bottom":
			return {
				left: `calc(${xPct * 100}% - ${PIN_R}px)`,
				top: `calc(${yPct * 100}% - ${PIN_CIRCLE + PIN_TIP}px)`,
			};
		case "top":
			return {
				left: `calc(${xPct * 100}% - ${PIN_R}px)`,
				top: `calc(${yPct * 100}%)`,
			};
		case "left":
			return {
				left: `calc(${xPct * 100}%)`,
				top: `calc(${yPct * 100}% - ${PIN_R}px)`,
			};
		case "right":
			return {
				left: `calc(${xPct * 100}% - ${PIN_CIRCLE + PIN_TIP}px)`,
				top: `calc(${yPct * 100}% - ${PIN_R}px)`,
			};
	}
}

function PinTriangle({ dir, color }: { dir: PointerDir; color: string }) {
	const tipBase = PIN_TIP * 0.7;
	const style: React.CSSProperties = { width: 0, height: 0 };

	switch (dir) {
		case "bottom":
			Object.assign(style, {
				borderLeft: `${tipBase}px solid transparent`,
				borderRight: `${tipBase}px solid transparent`,
				borderTop: `${PIN_TIP}px solid ${color}`,
				marginTop: "-1px",
			});
			break;
		case "top":
			Object.assign(style, {
				borderLeft: `${tipBase}px solid transparent`,
				borderRight: `${tipBase}px solid transparent`,
				borderBottom: `${PIN_TIP}px solid ${color}`,
				marginBottom: "-1px",
			});
			break;
		case "left":
			Object.assign(style, {
				borderTop: `${tipBase}px solid transparent`,
				borderBottom: `${tipBase}px solid transparent`,
				borderRight: `${PIN_TIP}px solid ${color}`,
				marginRight: "-1px",
			});
			break;
		case "right":
			Object.assign(style, {
				borderTop: `${tipBase}px solid transparent`,
				borderBottom: `${tipBase}px solid transparent`,
				borderLeft: `${PIN_TIP}px solid ${color}`,
				marginLeft: "-1px",
			});
			break;
	}

	return <div style={style} />;
}

function pinFlexDir(dir: PointerDir): string {
	switch (dir) {
		case "bottom":
			return "flex-col";
		case "top":
			return "flex-col-reverse";
		case "left":
			return "flex-row-reverse";
		case "right":
			return "flex-row";
	}
}

// ── Direction picker ──────────────────────────────────────────────────────────

const DIR_BUTTONS: { dir: PointerDir; icon: React.ReactNode }[] = [
	{ dir: "top", icon: <ArrowUp size={14} /> },
	{ dir: "bottom", icon: <ArrowDown size={14} /> },
	{ dir: "left", icon: <ArrowLeft size={14} /> },
	{ dir: "right", icon: <ArrowRight size={14} /> },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface ClimbImageViewerProps {
	image: ClimbImageWithUrl;
	onClose: () => void;
}

export const ClimbImageViewer = ({ image, onClose }: ClimbImageViewerProps) => {
	const { data: pins = [] } = useClimbImagePins(image.id);
	const addPin = useAddPin(image.id);
	const updatePin = useUpdatePin(image.id);
	const deletePin = useDeletePin(image.id);

	const imgRef = useRef<HTMLImageElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const magnifierRef = useRef<HTMLDivElement>(null);
	const [editMode, setEditMode] = useState(false);
	const [selectedPinType, setSelectedPinType] = useState<PinType>("lh");
	const [draggingPinId, setDraggingPinId] = useState<string | null>(null);
	const [activePinId, setActivePinId] = useState<string | null>(null);
	const [popoverPinId, setPopoverPinId] = useState<string | null>(null);
	const [editingDescription, setEditingDescription] = useState(false);
	const [descriptionInput, setDescriptionInput] = useState("");

	// Keep activePinId in sync with the pins list: default to first pin,
	// clear if the active pin is deleted.
	useEffect(() => {
		if (pins.length === 0) {
			setActivePinId(null);
		} else if (
			activePinId === null ||
			!pins.find((p) => p.id === activePinId)
		) {
			setActivePinId(pins[0].id);
		}
	}, [pins, activePinId]);

	// ── Coordinate helpers ─────────────────────────────────────────────────────

	function clientToImagePct(
		clientX: number,
		clientY: number,
	): { xPct: number; yPct: number } | null {
		const rect = imgRef.current?.getBoundingClientRect();
		if (!rect) return null;
		const xPct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
		const yPct = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
		return { xPct, yPct };
	}

	// ── Image tap — place pin in edit mode ────────────────────────────────────

	function handleImageClick(e: React.MouseEvent<HTMLDivElement>) {
		if (!editMode) return;
		if ((e.target as HTMLElement).closest("[data-pin]")) return;
		const coords = clientToImagePct(e.clientX, e.clientY);
		if (!coords) return;
		addPin.mutate({
			pinType: selectedPinType,
			xPct: coords.xPct,
			yPct: coords.yPct,
		});
		setPopoverPinId(null);
	}

	// ── Magnifier ──────────────────────────────────────────────────────────────

	// Draws a zoomed crop of the image onto the canvas, centred on the pin tip
	// position (clientX, clientY - DRAG_Y_OFFSET). Positions and shows the
	// magnifier container imperatively to avoid re-render jank.
	function showMagnifier(touchClientX: number, touchClientY: number) {
		const img = imgRef.current;
		const canvas = canvasRef.current;
		const container = magnifierRef.current;
		if (!img || !canvas || !container) return;

		// Position above the finger
		container.style.display = "block";
		container.style.left = `${touchClientX - MAGNIFIER_SIZE / 2}px`;
		container.style.top = `${touchClientY - MAGNIFIER_SIZE - MAGNIFIER_GAP}px`;

		// Draw zoomed region centred on the pin tip (adjusted touch position)
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const rect = img.getBoundingClientRect();
		const pinClientY = touchClientY - DRAG_Y_OFFSET;
		const scaleX = img.naturalWidth / rect.width;
		const scaleY = img.naturalHeight / rect.height;
		const naturalX = (touchClientX - rect.left) * scaleX;
		const naturalY = (pinClientY - rect.top) * scaleY;

		const cropW = MAGNIFIER_SIZE / MAGNIFIER_ZOOM;
		const cropH = MAGNIFIER_SIZE / MAGNIFIER_ZOOM;

		ctx.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
		ctx.drawImage(
			img,
			naturalX - cropW / 2,
			naturalY - cropH / 2,
			cropW,
			cropH,
			0,
			0,
			MAGNIFIER_SIZE,
			MAGNIFIER_SIZE,
		);

		// Crosshair at centre
		const mid = MAGNIFIER_SIZE / 2;
		ctx.strokeStyle = "rgba(0,0,0,0.4)";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(0, mid);
		ctx.lineTo(MAGNIFIER_SIZE, mid);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(mid, 0);
		ctx.lineTo(mid, MAGNIFIER_SIZE);
		ctx.stroke();
		ctx.strokeStyle = "rgba(255,255,255,0.9)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, mid);
		ctx.lineTo(MAGNIFIER_SIZE, mid);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(mid, 0);
		ctx.lineTo(mid, MAGNIFIER_SIZE);
		ctx.stroke();
	}

	function hideMagnifier() {
		if (magnifierRef.current) magnifierRef.current.style.display = "none";
	}

	// ── Touch drag ─────────────────────────────────────────────────────────────

	function handlePinTouchStart(
		e: React.TouchEvent<HTMLButtonElement>,
		pinId: string,
	) {
		if (!editMode) return;
		e.stopPropagation();
		setDraggingPinId(pinId);
		setPopoverPinId(null);
	}

	function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
		if (!draggingPinId) return;
		const touch = e.touches[0];
		const coords = clientToImagePct(
			touch.clientX,
			touch.clientY - DRAG_Y_OFFSET,
		);
		if (!coords) return;
		updatePin.mutate({
			id: draggingPinId,
			patch: { x_pct: coords.xPct, y_pct: coords.yPct },
		});
		showMagnifier(touch.clientX, touch.clientY);
	}

	function handleTouchEnd() {
		setDraggingPinId(null);
		hideMagnifier();
	}

	// ── Pin tap ────────────────────────────────────────────────────────────────

	function handlePinClick(
		e: React.MouseEvent<HTMLButtonElement>,
		pinId: string,
	) {
		e.stopPropagation();
		if (draggingPinId) return;
		setActivePinId(pinId);
		if (editMode) {
			setPopoverPinId(popoverPinId === pinId ? null : pinId);
			setEditingDescription(false);
		}
	}

	// ── Pin cycling ────────────────────────────────────────────────────────────

	function cyclePin(dir: -1 | 1) {
		if (pins.length === 0) return;
		const idx = pins.findIndex((p) => p.id === activePinId);
		const next = (idx + dir + pins.length) % pins.length;
		setActivePinId(pins[next].id);
		setPopoverPinId(null);
		setEditingDescription(false);
	}

	// ── Derived ────────────────────────────────────────────────────────────────

	const activePin = pins.find((p) => p.id === activePinId) ?? null;
	const activePinIndex = pins.findIndex((p) => p.id === activePinId);
	const popoverPin = pins.find((p) => p.id === popoverPinId) ?? null;

	return (
		<div className="fixed inset-0 z-50 bg-black flex flex-col">
			{/* Header */}
			<div
				className="flex items-center justify-between px-4 pb-2 shrink-0"
				style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
			>
				<button
					type="button"
					onClick={onClose}
					className="text-white"
					aria-label="Close"
				>
					<X size={24} />
				</button>
				<button
					type="button"
					onClick={() => {
						setEditMode(!editMode);
						setPopoverPinId(null);
						setEditingDescription(false);
					}}
					className={`text-sm font-semibold px-3 py-1 rounded-full ${
						editMode ? "bg-accent-primary text-white" : "bg-white/20 text-white"
					}`}
				>
					{editMode ? "Done" : "Edit pins"}
				</button>
			</div>

			{/* Pin type selector (edit mode only) */}
			{editMode && (
				<div className="flex justify-center gap-3 pb-2 shrink-0">
					{(
						Object.entries(PIN_CONFIG) as [
							PinType,
							{ label: string; color: string; mirror?: boolean },
						][]
					).map(([type, config]) => (
						<button
							key={type}
							type="button"
							onClick={() => setSelectedPinType(type)}
							className="w-10 h-10 rounded-full font-bold text-sm text-white flex items-center justify-center border-2 transition-all"
							style={{
								backgroundColor: config.color,
								borderColor: selectedPinType === type ? "white" : "transparent",
								opacity: selectedPinType === type ? 1 : 0.6,
							}}
						>
							{type === "lh" || type === "rh" ? (
								<HandGrab
									size={18}
									style={
										config.mirror ? { transform: "scaleX(-1)" } : undefined
									}
								/>
							) : (
								<FootIcon
									size={18}
									color="white"
									style={
										config.mirror ? { transform: "scaleX(-1)" } : undefined
									}
								/>
							)}
						</button>
					))}
				</div>
			)}

			{/* Image + pin overlay */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: touch canvas */}
			<div
				role="presentation"
				className="relative flex-1 flex items-center justify-center overflow-hidden"
				onClick={handleImageClick}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
			>
				<div className="relative inline-block">
					<img
						ref={imgRef}
						src={image.signed_url}
						alt=""
						className="max-w-full max-h-full object-contain select-none block"
						draggable={false}
					/>

					{pins.map((pin, index) => {
						const cfg = PIN_CONFIG[pin.pin_type];
						const dir: PointerDir = pin.pointer_dir ?? "bottom";
						const isActive = pin.id === activePinId;
						const isDragging = pin.id === draggingPinId;
						const opacity = isDragging ? 0.5 : isActive ? 1 : 0.5;

						return (
							<button
								key={pin.id}
								data-pin="true"
								type="button"
								aria-label={`Pin ${index + 1} — ${cfg.label}`}
								onTouchStart={(e) => handlePinTouchStart(e, pin.id)}
								onClick={(e) => handlePinClick(e, pin.id)}
								className={`absolute touch-none ${pinFlexDir(dir)} flex items-center`}
								style={{
									...pinPosition(pin.x_pct, pin.y_pct, dir),
									opacity,
									filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.6))",
									transition: "opacity 0.15s",
								}}
							>
								<div
									className="rounded-full flex items-center justify-center text-white font-bold"
									style={{
										width: PIN_CIRCLE,
										height: PIN_CIRCLE,
										fontSize: 10,
										backgroundColor: cfg.color,
										outline: isActive ? "2px solid white" : "none",
									}}
								>
									{index + 1}
								</div>
								<PinTriangle dir={dir} color={cfg.color} />
							</button>
						);
					})}
				</div>
			</div>

			{/* Persistent description bar */}
			{activePin && !popoverPin && (
				<div className="shrink-0 bg-surface-card flex items-center gap-2 px-3 py-3 border-t border-border-default">
					<button
						type="button"
						onClick={() => cyclePin(-1)}
						disabled={pins.length <= 1}
						className="text-text-secondary disabled:opacity-30 p-1"
						aria-label="Previous pin"
					>
						<ChevronLeft size={20} />
					</button>

					{/* biome-ignore lint/a11y/useKeyWithClickEvents: touch surface */}
					{/* biome-ignore lint/a11y/noStaticElementInteractions: touch surface */}
					<div
						className="flex-1 min-w-0"
						onClick={() => editMode && setPopoverPinId(activePin.id)}
					>
						<div className="flex items-center gap-1.5 mb-0.5">
							<span
								className="text-xs font-bold"
								style={{ color: PIN_CONFIG[activePin.pin_type].color }}
							>
								{activePinIndex + 1} · {PIN_CONFIG[activePin.pin_type].label}
							</span>
							{editMode && <Pencil size={11} className="text-text-tertiary" />}
						</div>
						<p className="text-sm text-text-secondary truncate">
							{activePin.description ?? "No note"}
						</p>
					</div>

					<button
						type="button"
						onClick={() => cyclePin(1)}
						disabled={pins.length <= 1}
						className="text-text-secondary disabled:opacity-30 p-1"
						aria-label="Next pin"
					>
						<ChevronRight size={20} />
					</button>
				</div>
			)}

			{/* Edit popover (triggered by tapping bar or pin in edit mode) */}
			{popoverPin && (
				<div
					className="shrink-0 bg-surface-card px-4 pt-3 flex flex-col gap-2 border-t border-border-default"
					style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
				>
					<div className="flex items-center justify-between">
						<span
							className="text-sm font-semibold"
							style={{ color: PIN_CONFIG[popoverPin.pin_type].color }}
						>
							Pin {(pins.findIndex((p) => p.id === popoverPin.id) ?? 0) + 1} —{" "}
							{PIN_CONFIG[popoverPin.pin_type].label}
						</span>
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={() => {
									setEditingDescription(true);
									setDescriptionInput(popoverPin.description ?? "");
								}}
								className="text-text-secondary"
								aria-label="Edit description"
							>
								<Pencil size={16} />
							</button>
							<button
								type="button"
								onClick={() => {
									deletePin.mutate(popoverPin.id);
									setPopoverPinId(null);
								}}
								className="text-red-400"
								aria-label="Delete pin"
							>
								<Trash2 size={16} />
							</button>
							<button
								type="button"
								onClick={() => {
									setPopoverPinId(null);
									setEditingDescription(false);
								}}
								className="text-text-tertiary"
								aria-label="Close"
							>
								<X size={16} />
							</button>
						</div>
					</div>

					{/* Direction picker */}
					{!editingDescription && (
						<div className="flex items-center gap-1">
							<span className="text-xs text-text-tertiary mr-1">
								Direction:
							</span>
							{DIR_BUTTONS.map(({ dir, icon }) => (
								<button
									key={dir}
									type="button"
									onClick={() =>
										updatePin.mutate({
											id: popoverPin.id,
											patch: { pointer_dir: dir },
										})
									}
									className="w-7 h-7 rounded flex items-center justify-center transition-colors"
									style={{
										backgroundColor:
											(popoverPin.pointer_dir ?? "bottom") === dir
												? PIN_CONFIG[popoverPin.pin_type].color
												: undefined,
										color:
											(popoverPin.pointer_dir ?? "bottom") === dir
												? "white"
												: undefined,
									}}
									aria-label={`Point ${dir}`}
								>
									{icon}
								</button>
							))}
						</div>
					)}

					{editingDescription ? (
						<div className="flex gap-2">
							<Input
								value={descriptionInput}
								onChange={(e) => setDescriptionInput(e.target.value)}
								placeholder="Describe this move…"
								className="flex-1"
							/>
							<button
								type="button"
								onClick={() => {
									updatePin.mutate({
										id: popoverPin.id,
										patch: { description: descriptionInput || null },
									});
									setEditingDescription(false);
								}}
								className="text-accent-primary text-sm font-semibold"
							>
								Save
							</button>
						</div>
					) : (
						<p className="text-sm text-text-secondary">
							{popoverPin.description ?? "Tap pencil to add note"}
						</p>
					)}
				</div>
			)}

			{/* Hint (edit mode, no popover, no pins) */}
			{editMode && !popoverPin && pins.length === 0 && (
				<p
					className="shrink-0 text-center text-xs text-white/50 px-4"
					style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
				>
					Tap image to place a pin
				</p>
			)}

			{/* Safe area padding when bar is visible */}
			{(activePin || popoverPin) && (
				<div
					className="shrink-0 bg-surface-card"
					style={{ height: "env(safe-area-inset-bottom)" }}
				/>
			)}

			{/* Drag magnifier — always in DOM, shown/hidden imperatively during drag */}
			<div
				ref={magnifierRef}
				className="fixed pointer-events-none z-[60]"
				style={{ display: "none" }}
			>
				<canvas
					ref={canvasRef}
					width={MAGNIFIER_SIZE}
					height={MAGNIFIER_SIZE}
					className="block rounded-full"
					style={{
						border: "2px solid white",
						boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
					}}
				/>
			</div>
		</div>
	);
};
