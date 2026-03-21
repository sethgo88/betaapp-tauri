import { useState } from "react";
import type { RouteTopo, WallTopo, WallTopoLine } from "@/features/topos/topos.schema";

interface RouteInfo {
	id: string;
	name: string;
	grade: string;
}

// ── Wall topo viewer (multiple lines, selectable) ─────────────────────────────

interface WallTopoViewerProps {
	topo: WallTopo;
	lines: WallTopoLine[];
	routes: RouteInfo[];
	/** If set, only this route's line is shown and highlighted (no bottom panel) */
	singleRouteId?: string;
}

export const WallTopoViewer = ({
	topo,
	lines,
	routes,
	singleRouteId,
}: WallTopoViewerProps) => {
	const [selectedRouteId, setSelectedRouteId] = useState<string | null>(
		singleRouteId ?? null,
	);

	const isSingleMode = singleRouteId !== undefined;

	const visibleLines = isSingleMode
		? lines.filter((l) => l.route_id === singleRouteId)
		: lines;

	const selectedRoute = routes.find((r) => r.id === selectedRouteId);

	const pointsStr = (line: WallTopoLine) =>
		line.points.map((p) => `${p.x_pct * 100},${p.y_pct * 100}`).join(" ");

	return (
		<div className="flex flex-col w-full h-full">
			{/* Image + SVG overlay */}
			<div className="relative w-full flex-1 min-h-0">
				<img
					src={topo.image_url}
					alt="Wall topo"
					className="w-full h-full object-contain"
					draggable={false}
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
								<polyline
									points={pointsStr(line)}
									stroke="transparent"
									strokeWidth="8"
									fill="none"
									style={{ cursor: "pointer" }}
									onClick={() =>
										!isSingleMode && setSelectedRouteId(line.route_id)
									}
								/>
								{/* Visible line */}
								<polyline
									points={pointsStr(line)}
									stroke={line.color}
									strokeWidth="2"
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

			{/* Bottom panel — only in multi-route mode */}
			{!isSingleMode && (
				<div className="shrink-0 bg-surface-card rounded-b-lg overflow-hidden">
					{/* Selected route header */}
					{selectedRoute && (
						<div className="flex items-center justify-between px-4 py-2 border-b border-border-default">
							<span className="font-medium text-sm text-text-primary">
								{selectedRoute.name}
							</span>
							<span className="text-xs text-text-secondary">
								{selectedRoute.grade}
							</span>
						</div>
					)}

					{/* Route list */}
					<div
						className="overflow-y-auto"
						style={{ maxHeight: "40vh", scrollbarWidth: "none" }}
					>
						{lines.map((line) => {
							const route = routes.find((r) => r.id === line.route_id);
							if (!route) return null;
							const isActive = selectedRouteId === route.id;
							return (
								<button
									key={line.id}
									type="button"
									onClick={() =>
										setSelectedRouteId(isActive ? null : route.id)
									}
									className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-surface-page transition-colors"
								>
									{/* Color swatch */}
									<span
										className="shrink-0 w-3 h-3 rounded-full"
										style={{
											backgroundColor: line.color,
											opacity: isActive || selectedRouteId === null ? 1 : 0.5,
										}}
									/>
									<span
										className={`flex-1 text-sm ${isActive ? "font-semibold text-text-primary" : "text-text-secondary"}`}
									>
										{route.name}
									</span>
									<span className="text-xs text-text-tertiary">
										{route.grade}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			)}
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
						strokeWidth="2"
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
