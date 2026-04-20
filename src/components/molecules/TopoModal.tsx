import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
	RouteTopo,
	WallTopo,
	WallTopoLine,
} from "@/features/topos/topos.schema";
import { RouteTopoViewer, WallTopoPanel, WallTopoViewer } from "./TopoViewer";

interface RouteInfo {
	id: string;
	name: string;
	grade: string;
	route_type: "sport" | "boulder" | "trad";
}

interface BaseProps {
	onClose: () => void;
}

interface WallTopoModalProps extends BaseProps {
	mode: "wall";
	topo: WallTopo;
	lines: WallTopoLine[];
	routes: RouteInfo[];
	onNavigateToRoute?: (routeId: string) => void;
}

interface WallSingleTopoModalProps extends BaseProps {
	mode: "wall-single";
	topo: WallTopo;
	lines: WallTopoLine[];
	routes: RouteInfo[];
	routeId: string;
}

interface RouteTopoModalProps extends BaseProps {
	mode: "route";
	topo: RouteTopo;
}

type TopoModalProps =
	| WallTopoModalProps
	| WallSingleTopoModalProps
	| RouteTopoModalProps;

export const TopoModal = (props: TopoModalProps) => {
	const { onClose } = props;

	// Wall mode: route selection state lifted out of WallTopoViewer so panel stays outside zoom
	const [wallSelectedRouteId, setWallSelectedRouteId] = useState<string | null>(
		null,
	);

	// Transform state: translate + scale (so we can pan independently of zoom)
	const [xf, setXf] = useState({ scale: 1, tx: 0, ty: 0, animated: false });
	// Live ref so touch handlers always see current values without stale closures
	const xfRef = useRef(xf);
	const containerRef = useRef<HTMLDivElement>(null);
	const lastPinchDist = useRef<number | null>(null);
	const lastPinchMid = useRef<{ x: number; y: number } | null>(null);
	const lastPanTouch = useRef<{ x: number; y: number } | null>(null);
	const lastTap = useRef<number>(0);

	const clamp = (v: number, lo: number, hi: number) =>
		Math.min(hi, Math.max(lo, v));

	const applyTransform = (
		scale: number,
		tx: number,
		ty: number,
		animated = false,
	) => {
		const s = clamp(scale, 1, 4);
		// At 1× zoom: always snap to center (no panning)
		if (s === 1) {
			const next = { scale: 1, tx: 0, ty: 0, animated };
			xfRef.current = next;
			setXf(next);
			return;
		}
		// Clamp pan so image edges can't go past the container edges
		const rect = containerRef.current?.getBoundingClientRect();
		const maxTx = rect ? (rect.width * (s - 1)) / 2 : 0;
		const maxTy = rect ? (rect.height * (s - 1)) / 2 : 0;
		const next = {
			scale: s,
			tx: clamp(tx, -maxTx, maxTx),
			ty: clamp(ty, -maxTy, maxTy),
			animated,
		};
		xfRef.current = next;
		setXf(next);
	};

	// Close on Android back (Escape key)
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onClose]);

	const handleTouchStart = (e: React.TouchEvent) => {
		if (e.touches.length === 2) {
			lastPanTouch.current = null;
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			lastPinchDist.current = Math.hypot(dx, dy);
			lastPinchMid.current = {
				x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
				y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
			};
		} else if (e.touches.length === 1) {
			lastPinchDist.current = null;
			lastPinchMid.current = null;
			lastPanTouch.current = {
				x: e.touches[0].clientX,
				y: e.touches[0].clientY,
			};
		}
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (
			e.touches.length === 2 &&
			lastPinchDist.current !== null &&
			lastPinchMid.current !== null
		) {
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			const dist = Math.hypot(dx, dy);
			const newMid = {
				x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
				y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
			};

			const rect = containerRef.current?.getBoundingClientRect();
			if (rect) {
				const { scale, tx, ty } = xfRef.current;
				const newScale = clamp(scale * (dist / lastPinchDist.current), 1, 4);
				// Keep the pinch center point fixed in content space
				const ccx = rect.left + rect.width / 2;
				const ccy = rect.top + rect.height / 2;
				const contentPx = (lastPinchMid.current.x - ccx - tx) / scale;
				const contentPy = (lastPinchMid.current.y - ccy - ty) / scale;
				const newTx = newMid.x - ccx - contentPx * newScale;
				const newTy = newMid.y - ccy - contentPy * newScale;
				applyTransform(newScale, newTx, newTy);
			}

			lastPinchDist.current = dist;
			lastPinchMid.current = newMid;
		} else if (e.touches.length === 1 && lastPanTouch.current !== null) {
			// Single-finger pan — only when zoomed in
			const { scale, tx, ty } = xfRef.current;
			if (scale <= 1) return;
			const panDx = e.touches[0].clientX - lastPanTouch.current.x;
			const panDy = e.touches[0].clientY - lastPanTouch.current.y;
			lastPanTouch.current = {
				x: e.touches[0].clientX,
				y: e.touches[0].clientY,
			};
			applyTransform(scale, tx + panDx, ty + panDy);
		}
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		if (e.touches.length === 1) {
			// Transition from pinch back to single finger — resume pan
			lastPinchDist.current = null;
			lastPinchMid.current = null;
			lastPanTouch.current = {
				x: e.touches[0].clientX,
				y: e.touches[0].clientY,
			};
		} else if (e.touches.length === 0) {
			lastPinchDist.current = null;
			lastPinchMid.current = null;
			lastPanTouch.current = null;
			// Double-tap to reset zoom
			if (e.changedTouches.length === 1) {
				const now = Date.now();
				if (now - lastTap.current < 300) {
					applyTransform(1, 0, 0, true);
				}
				lastTap.current = now;
			}
		}
	};

	return (
		<div className="fixed inset-0 z-50 bg-sheet-bg flex flex-col">
			{/* Header */}
			<div
				className="shrink-0 flex items-center px-4 py-3"
				style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
			>
				<button
					type="button"
					onClick={onClose}
					className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white"
					aria-label="Close"
				>
					<X size={18} />
				</button>
			</div>

			{/* Zoomable + pannable content */}
			<div
				ref={containerRef}
				className="flex-1 overflow-hidden relative flex items-center justify-center"
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				style={{ touchAction: "none" }}
			>
				<div
					className="w-full h-full"
					style={{
						transform: `translate(${xf.tx}px, ${xf.ty}px) scale(${xf.scale})`,
						transformOrigin: "center center",
						transition: xf.animated ? "transform 0.2s ease-out" : "none",
					}}
				>
					{props.mode === "wall" && (
						<WallTopoViewer
							topo={props.topo}
							lines={props.lines}
							routes={props.routes}
							selectedRouteId={wallSelectedRouteId}
							onSelectRoute={setWallSelectedRouteId}
							imageOnly={true}
						/>
					)}
					{props.mode === "wall-single" && (
						<WallTopoViewer
							topo={props.topo}
							lines={props.lines}
							routes={props.routes}
							singleRouteId={props.routeId}
						/>
					)}
					{props.mode === "route" && <RouteTopoViewer topo={props.topo} />}
				</div>
			</div>

			{/* Route list panel — outside zoom so it stays fixed */}
			{props.mode === "wall" && (
				<WallTopoPanel
					lines={props.lines}
					routes={props.routes}
					selectedRouteId={wallSelectedRouteId}
					onSelectRoute={setWallSelectedRouteId}
					onNavigateToRoute={props.onNavigateToRoute}
				/>
			)}
		</div>
	);
};
