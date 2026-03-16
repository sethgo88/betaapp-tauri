import { HandGrab, Pencil, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
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

const PIN_CIRCLE = 28; // diameter of the circle head
const PIN_TIP = 10; // height of the triangle tip below the circle
const DRAG_Y_OFFSET = 35; // px — shifts pin below finger during drag so it's visible

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
	const [editMode, setEditMode] = useState(false);
	const [selectedPinType, setSelectedPinType] = useState<PinType>("lh");
	const [draggingPinId, setDraggingPinId] = useState<string | null>(null);
	const [popoverPinId, setPopoverPinId] = useState<string | null>(null);
	const [editingDescription, setEditingDescription] = useState(false);
	const [descriptionInput, setDescriptionInput] = useState("");

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
		// Apply upward offset so the pin tip sits below the finger, not under it
		const coords = clientToImagePct(
			touch.clientX,
			touch.clientY - DRAG_Y_OFFSET,
		);
		if (!coords) return;
		updatePin.mutate({
			id: draggingPinId,
			patch: { x_pct: coords.xPct, y_pct: coords.yPct },
		});
	}

	function handleTouchEnd() {
		setDraggingPinId(null);
	}

	// ── Pin tap — open popover ─────────────────────────────────────────────────

	function handlePinClick(
		e: React.MouseEvent<HTMLButtonElement>,
		pinId: string,
	) {
		e.stopPropagation();
		if (draggingPinId) return;
		setPopoverPinId(popoverPinId === pinId ? null : pinId);
		setEditingDescription(false);
	}

	// ── Render ─────────────────────────────────────────────────────────────────

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

			{/* Image + pin overlay — role="presentation" because this is a canvas-like
			    touch surface, not a discrete interactive element. Keyboard interaction
			    is not applicable (pin placement is inherently pointer-based). */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: touch canvas */}
			<div
				role="presentation"
				className="relative flex-1 flex items-center justify-center overflow-hidden"
				onClick={handleImageClick}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
			>
				{/* Wrapper constrains pin positions to the visible image area */}
				<div className="relative inline-block">
					<img
						ref={imgRef}
						src={image.signed_url}
						alt=""
						className="max-w-full max-h-full object-contain select-none block"
						draggable={false}
					/>

					{/* Pins — anchor point is the tip of the triangle (bottom center) */}
					{pins.map((pin) => {
						const cfg = PIN_CONFIG[pin.pin_type];
						return (
							<button
								key={pin.id}
								data-pin="true"
								type="button"
								aria-label={`${cfg.label} pin`}
								onTouchStart={(e) => handlePinTouchStart(e, pin.id)}
								onClick={(e) => handlePinClick(e, pin.id)}
								className="absolute flex flex-col items-center touch-none"
								style={{
									left: `calc(${pin.x_pct * 100}% - ${PIN_CIRCLE / 2}px)`,
									top: `calc(${pin.y_pct * 100}% - ${PIN_CIRCLE + PIN_TIP}px)`,

									opacity: draggingPinId === pin.id ? 0.6 : 1,

									filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
								}}
							>
								{/* Circle head */}
								<div
									className="rounded-full flex items-center justify-center text-white font-bold text-xs"
									style={{
										width: PIN_CIRCLE,
										height: PIN_CIRCLE,
										backgroundColor: cfg.color,
									}}
								>
									{pin.pin_type === "lh" || pin.pin_type === "rh" ? (
										<HandGrab
											size={16}
											style={
												cfg.mirror ? { transform: "scaleX(-1)" } : undefined
											}
										/>
									) : (
										<FootIcon
											size={16}
											color="white"
											style={
												cfg.mirror ? { transform: "scaleX(-1)" } : undefined
											}
										/>
									)}
								</div>
								{/* Triangle tip */}
								<div
									style={{
										width: 0,
										height: 0,
										borderLeft: `${PIN_TIP / 1.5}px solid transparent`,
										borderRight: `${PIN_TIP / 1.5}px solid transparent`,
										borderTop: `${PIN_TIP}px solid ${cfg.color}`,
										marginTop: "-2px",
									}}
								/>
							</button>
						);
					})}
				</div>
			</div>

			{/* Pin popover */}
			{popoverPin && (
				<div
					className="shrink-0 bg-surface-card px-4 pt-3 flex flex-col gap-2"
					style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
				>
					<div className="flex items-center justify-between">
						<span
							className="text-sm font-semibold"
							style={{ color: PIN_CONFIG[popoverPin.pin_type].color }}
						>
							{PIN_CONFIG[popoverPin.pin_type].label}
						</span>
						{editMode && (
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
							</div>
						)}
					</div>

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
							{popoverPin.description ??
								(editMode ? "Tap pencil to add note" : "No note")}
						</p>
					)}
				</div>
			)}

			{editMode && !popoverPin && (
				<p
					className="shrink-0 text-center text-xs text-white/50 px-4"
					style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
				>
					Tap image to place pin · Drag pins to reposition · Tap pin to edit
				</p>
			)}
		</div>
	);
};
