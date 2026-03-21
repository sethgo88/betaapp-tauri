import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { RouteTopo, WallTopo, WallTopoLine } from "@/features/topos/topos.schema";
import { RouteTopoViewer, WallTopoViewer } from "./TopoViewer";

interface RouteInfo {
	id: string;
	name: string;
	grade: string;
}

interface BaseProps {
	onClose: () => void;
}

interface WallTopoModalProps extends BaseProps {
	mode: "wall";
	topo: WallTopo;
	lines: WallTopoLine[];
	routes: RouteInfo[];
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

	// Pinch-to-zoom state
	const [scale, setScale] = useState(1);
	const [origin, setOrigin] = useState({ x: 0, y: 0 });
	const lastDistance = useRef<number | null>(null);
	const lastTap = useRef<number>(0);
	const containerRef = useRef<HTMLDivElement>(null);

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
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			lastDistance.current = Math.hypot(dx, dy);
		}
	};

	const handleTouchMove = (e: React.TouchEvent) => {
		if (e.touches.length === 2 && lastDistance.current !== null) {
			const dx = e.touches[0].clientX - e.touches[1].clientX;
			const dy = e.touches[0].clientY - e.touches[1].clientY;
			const dist = Math.hypot(dx, dy);
			const delta = dist / lastDistance.current;
			lastDistance.current = dist;

			// Pinch center as transform origin
			const rect = containerRef.current?.getBoundingClientRect();
			if (rect) {
				const cx =
					((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) /
					rect.width;
				const cy =
					((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) /
					rect.height;
				setOrigin({ x: cx * 100, y: cy * 100 });
			}

			setScale((s) => Math.min(4, Math.max(1, s * delta)));
		}
	};

	const handleTouchEnd = (e: React.TouchEvent) => {
		if (e.touches.length < 2) {
			lastDistance.current = null;
		}
		// Double-tap to reset zoom
		if (e.changedTouches.length === 1) {
			const now = Date.now();
			if (now - lastTap.current < 300) {
				setScale(1);
				setOrigin({ x: 50, y: 50 });
			}
			lastTap.current = now;
		}
	};

	return (
		<div className="fixed inset-0 z-50 bg-black flex flex-col">
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

			{/* Zoomable content */}
			<div
				ref={containerRef}
				className="flex-1 overflow-hidden relative"
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				style={{ touchAction: "none" }}
			>
				<div
					className="w-full h-full"
					style={{
						transform: `scale(${scale})`,
						transformOrigin: `${origin.x}% ${origin.y}%`,
						transition:
							lastDistance.current === null ? "transform 0.15s ease-out" : "none",
					}}
				>
					{props.mode === "wall" && (
						<WallTopoViewer
							topo={props.topo}
							lines={props.lines}
							routes={props.routes}
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
		</div>
	);
};
