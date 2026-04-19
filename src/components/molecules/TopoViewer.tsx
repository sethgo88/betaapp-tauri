import { ExternalLink } from "lucide-react";
import { useState } from "react";
import type {
	RouteTopo,
	WallTopo,
	WallTopoLine,
} from "@/features/topos/topos.schema";

type RouteType = "sport" | "boulder" | "trad";

interface RouteInfo {
	id: string;
	name: string;
	grade: string;
	route_type: RouteType;
}

function routeTypeInitial(type: RouteType): string {
	if (type === "sport") return "S";
	if (type === "boulder") return "B";
	return "T";
}

// ── Wall topo viewer (multiple lines, selectable) ─────────────────────────────

interface WallTopoViewerProps {
	topo: WallTopo;
	lines: WallTopoLine[];
	routes: RouteInfo[];
	/** If set, only this route's line is shown and highlighted (no bottom panel) */
	singleRouteId?: string;
	/** Controlled selection — provide alongside onSelectRoute to manage state externally */
	selectedRouteId?: string | null;
	onSelectRoute?: (id: string | null) => void;
	/** When true, renders only the image+SVG (no bottom panel) */
	imageOnly?: boolean;
}

export const WallTopoViewer = ({
	topo,
	lines,
	routes,
	singleRouteId,
	selectedRouteId: controlledSelectedId,
	onSelectRoute: controlledOnSelect,
	imageOnly,
}: WallTopoViewerProps) => {
	const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
		singleRouteId ?? null,
	);
	const [naturalAspectRatio, setNaturalAspectRatio] = useState<number | null>(
		null,
	);

	const selectedRouteId =
		controlledSelectedId !== undefined
			? controlledSelectedId
			: internalSelectedId;
	const onSelectRoute = controlledOnSelect ?? setInternalSelectedId;

	const isSingleMode = singleRouteId !== undefined;

	const visibleLines = isSingleMode
		? lines.filter((l) => l.route_id === singleRouteId)
		: lines;

	const pointsStr = (line: WallTopoLine) =>
		line.points.map((p) => `${p.x_pct * 100},${p.y_pct * 100}`).join(" ");

	return (
		<div className="flex flex-col w-full h-full">
			{/* Image + SVG overlay */}
			<div
				className="relative w-full"
				style={
					naturalAspectRatio !== null
						? { aspectRatio: naturalAspectRatio }
						: undefined
				}
			>
				<img
					src={topo.image_url}
					alt="Wall topo"
					className="w-full"
					draggable={false}
					onLoad={(e) => {
						const { naturalWidth, naturalHeight } = e.currentTarget;
						if (naturalWidth > 0 && naturalHeight > 0) {
							setNaturalAspectRatio(naturalWidth / naturalHeight);
						}
					}}
				/>
				<svg
					className="absolute inset-0 w-full h-full"
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
					aria-hidden="true"
				>
					{visibleLines.map((line) => {
						const isSelected =
							selectedRouteId === null || selectedRouteId === line.route_id;
						const opacity = isSingleMode
							? 1
							: selectedRouteId === null
								? 1
								: isSelected
									? 1
									: 0.5;

						return (
							<g key={line.id}>
								{/* Fat invisible hit target */}
								{/* biome-ignore lint/a11y/noStaticElementInteractions: SVG polyline used as click target for route selection */}
								<polyline
									points={pointsStr(line)}
									stroke="transparent"
									strokeWidth="8"
									fill="none"
									style={{ cursor: "pointer" }}
									onClick={() => !isSingleMode && onSelectRoute(line.route_id)}
								/>
								{/* Visible line */}
								<polyline
									points={pointsStr(line)}
									stroke={line.color}
									strokeWidth="4"
									fill="none"
									opacity={opacity}
									strokeLinecap="round"
									strokeLinejoin="round"
									vectorEffect="non-scaling-stroke"
									style={{ pointerEvents: "none" }}
								/>
							</g>
						);
					})}
				</svg>
			</div>

			{/* Bottom panel — only in multi-route uncontrolled mode */}
			{!isSingleMode && !imageOnly && (
				<WallTopoPanel
					lines={lines}
					routes={routes}
					selectedRouteId={selectedRouteId}
					onSelectRoute={onSelectRoute}
				/>
			)}
		</div>
	);
};

// ── Wall topo bottom panel (route list) ───────────────────────────────────────

interface WallTopoPanelProps {
	lines: WallTopoLine[];
	routes: RouteInfo[];
	selectedRouteId: string | null;
	onSelectRoute: (id: string | null) => void;
	onNavigateToRoute?: (routeId: string) => void;
}

export const WallTopoPanel = ({
	lines,
	routes,
	selectedRouteId,
	onSelectRoute,
	onNavigateToRoute,
}: WallTopoPanelProps) => {
	return (
		<div className="shrink-0 bg-cyan-900 rounded-b-lg overflow-hidden">
			<div
				className="overflow-y-auto"
				style={{ maxHeight: "40vh", scrollbarWidth: "none" }}
			>
				{lines.map((line) => {
					const route = routes.find((r) => r.id === line.route_id);
					if (!route) return null;
					const isActive = selectedRouteId === route.id;
					// biome-ignore lint/a11y/useKeyWithClickEvents: touch-only mobile app
					return (
						<div
							key={line.id}
							role="button"
							tabIndex={0}
							onClick={() => onSelectRoute(isActive ? null : route.id)}
							className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/10 transition-colors cursor-pointer"
						>
							<span
								className="shrink-0 w-3 h-3 rounded-full"
								style={{
									backgroundColor: line.color,
									opacity: isActive || selectedRouteId === null ? 1 : 0.5,
								}}
							/>
							<span
								className={`flex-1 text-sm ${isActive ? "font-semibold text-white" : "text-white/70"}`}
							>
								{route.name}
							</span>
							<span className="text-xs text-white/50 font-medium uppercase">
								{routeTypeInitial(route.route_type)}
							</span>
							<span className="text-xs text-white/50">{route.grade}</span>
							{onNavigateToRoute && (
								<button
									type="button"
									aria-label={`Go to ${route.name}`}
									className="shrink-0 text-white/50 hover:text-white"
									onClick={(e) => {
										e.stopPropagation();
										onNavigateToRoute(route.id);
									}}
								>
									<ExternalLink size={14} />
								</button>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

// ── Route topo viewer (single line) ──────────────────────────────────────────

interface RouteTopoViewerProps {
	topo: RouteTopo;
}

export const RouteTopoViewer = ({ topo }: RouteTopoViewerProps) => {
	const pointsStr = topo.points
		.map((p) => `${p.x_pct * 100},${p.y_pct * 100}`)
		.join(" ");

	return (
		<div className="relative w-full">
			<img
				src={topo.image_url}
				alt="Route topo"
				className="w-full object-contain"
				draggable={false}
			/>
			{topo.points.length >= 2 && (
				<svg
					className="absolute inset-0 w-full h-full"
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
					aria-hidden="true"
				>
					<polyline
						points={pointsStr}
						stroke={topo.color}
						strokeWidth="4"
						fill="none"
						strokeLinecap="round"
						strokeLinejoin="round"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>
			)}
		</div>
	);
};
