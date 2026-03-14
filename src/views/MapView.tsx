import { useNavigate, useSearch } from "@tanstack/react-router";
import {
	checkPermissions,
	getCurrentPosition,
	requestPermissions,
} from "@tauri-apps/plugin-geolocation";
import L from "leaflet";
import { Crosshair, Layers, MapPin, Minus, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { Spinner } from "@/components/atoms/Spinner";
import { useAllCragsWithCoords } from "@/features/locations/locations.queries";
import { usePersonalCrags } from "@/features/map/map.queries";
import { tileLayers } from "@/lib/map-tiles";

// ── Marker icon with route count ────────────────────────────────────────────

const iconCache = new Map<string, L.DivIcon>();

function countIcon(count: number, color: string): L.DivIcon {
	const key = `${count}-${color}`;
	const cached = iconCache.get(key);
	if (cached) return cached;

	const icon = L.divIcon({
		className: "",
		iconSize: [32, 40],
		iconAnchor: [16, 40],
		popupAnchor: [0, -40],
		html: `<div style="
			display:flex;align-items:center;justify-content:center;
			width:32px;height:32px;border-radius:50%;
			background:${color};color:#fff;
			font-weight:700;font-size:13px;font-family:sans-serif;
			box-shadow:0 2px 6px rgba(0,0,0,.35);
			position:relative;
		">${count}<span style="
			position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);
			width:0;height:0;
			border-left:6px solid transparent;
			border-right:6px solid transparent;
			border-top:8px solid ${color};
		"></span></div>`,
	});
	iconCache.set(key, icon);
	return icon;
}

// ── Map controls (rendered inside MapContainer) ─────────────────────────────

const MapControls = ({
	activeLayer,
	onLayerChange,
}: {
	activeLayer: string;
	onLayerChange: (id: string) => void;
}) => {
	const map = useMap();
	const [layerPanelOpen, setLayerPanelOpen] = useState(false);
	const [locating, setLocating] = useState(false);

	const handleZoomIn = useCallback(() => map.zoomIn(), [map]);
	const handleZoomOut = useCallback(() => map.zoomOut(), [map]);

	const handleLocate = useCallback(async () => {
		setLocating(true);
		try {
			let perms = await checkPermissions();
			if (
				perms.location === "prompt" ||
				perms.location === "prompt-with-rationale"
			) {
				perms = await requestPermissions(["location"]);
			}
			if (perms.location !== "granted") {
				setLocating(false);
				return;
			}
			const pos = await getCurrentPosition();
			map.setView([pos.coords.latitude, pos.coords.longitude], 14);
		} catch {
			// Permission denied or location unavailable
		} finally {
			setLocating(false);
		}
	}, [map]);

	return (
		<div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
			{/* Layers button */}
			<div className="relative">
				<button
					type="button"
					onClick={() => setLayerPanelOpen((p) => !p)}
					className="flex items-center justify-center w-10 h-10 rounded-[--radius-md] bg-surface-card border border-border-default shadow-sm"
				>
					<Layers size={18} className="text-text-primary" />
				</button>
				{layerPanelOpen && (
					<div className="absolute right-0 top-12 w-36 bg-surface-card border border-border-default rounded-[--radius-md] shadow-md overflow-hidden">
						{tileLayers.map((layer) => (
							<button
								key={layer.id}
								type="button"
								onClick={() => {
									onLayerChange(layer.id);
									setLayerPanelOpen(false);
								}}
								className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left ${
									activeLayer === layer.id
										? "bg-accent-primary/15 text-accent-primary font-semibold"
										: "text-text-primary"
								}`}
							>
								<layer.icon size={16} />
								{layer.name}
							</button>
						))}
					</div>
				)}
			</div>

			{/* Zoom in */}
			<button
				type="button"
				onClick={handleZoomIn}
				className="flex items-center justify-center w-10 h-10 rounded-[--radius-md] bg-surface-card border border-border-default shadow-sm"
			>
				<Plus size={18} className="text-text-primary" />
			</button>

			{/* Zoom out */}
			<button
				type="button"
				onClick={handleZoomOut}
				className="flex items-center justify-center w-10 h-10 rounded-[--radius-md] bg-surface-card border border-border-default shadow-sm"
			>
				<Minus size={18} className="text-text-primary" />
			</button>

			{/* Center on location */}
			<button
				type="button"
				onClick={handleLocate}
				disabled={locating}
				className="flex items-center justify-center w-10 h-10 rounded-[--radius-md] bg-surface-card border border-border-default shadow-sm"
			>
				<Crosshair
					size={18}
					className={
						locating ? "text-accent-primary animate-pulse" : "text-text-primary"
					}
				/>
			</button>
		</div>
	);
};

// ── Filter checkbox ─────────────────────────────────────────────────────────

const FilterCheck = ({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) => (
	<label className="flex items-center gap-1.5 text-sm text-text-secondary">
		<input
			type="checkbox"
			checked={checked}
			onChange={(e) => onChange(e.target.checked)}
			className="accent-accent-primary"
		/>
		{label}
	</label>
);

// ── MapView ─────────────────────────────────────────────────────────────────

type Mode = "discovery" | "personal";

const MapView = () => {
	const navigate = useNavigate();
	const {
		lat: searchLat,
		lng: searchLng,
		zoom: searchZoom,
	} = useSearch({ from: "/map" });
	const [mode, setMode] = useState<Mode>("discovery");
	const [activeLayerId, setActiveLayerId] = useState("osm");

	// Discovery filters
	const [showSport, setShowSport] = useState(true);
	const [showBoulder, setShowBoulder] = useState(true);

	// Personal filters
	const [showSent, setShowSent] = useState(true);
	const [showProject, setShowProject] = useState(true);
	const [showTodo, setShowTodo] = useState(true);

	const { data: allCrags = [], isLoading: loadingDiscovery } =
		useAllCragsWithCoords();
	const { data: personalCrags = [], isLoading: loadingPersonal } =
		usePersonalCrags();

	const isLoading = mode === "discovery" ? loadingDiscovery : loadingPersonal;

	// Filter personal crags
	const filteredPersonal = useMemo(
		() =>
			personalCrags.filter((c) => {
				if (showSent && c.has_sent) return true;
				if (showProject && c.has_project) return true;
				if (showTodo && c.has_todo) return true;
				return !showSent && !showProject && !showTodo;
			}),
		[personalCrags, showSent, showProject, showTodo],
	);

	// Compute map center — search params override marker-based center
	const hasSearchCoords = searchLat != null && searchLng != null;
	const center = useMemo<[number, number]>(() => {
		if (hasSearchCoords) return [searchLat, searchLng];
		const items = mode === "discovery" ? allCrags : filteredPersonal;
		if (items.length === 0) return [43.0, 12.0]; // Default: Europe
		const avgLat = items.reduce((s, c) => s + (c.lat ?? 0), 0) / items.length;
		const avgLng = items.reduce((s, c) => s + (c.lng ?? 0), 0) / items.length;
		return [avgLat, avgLng];
	}, [hasSearchCoords, searchLat, searchLng, mode, allCrags, filteredPersonal]);
	const initialZoom = hasSearchCoords ? (searchZoom ?? 14) : 6;

	const activeLayer =
		tileLayers.find((l) => l.id === activeLayerId) ?? tileLayers[0];

	return (
		<div
			className="flex flex-col -mx-4 -mt-4"
			style={{
				height: "calc(100dvh - env(safe-area-inset-top) - 7vh - 1.5rem)",
			}}
		>
			{/* Controls bar */}
			<div className="flex flex-col gap-2 px-4 py-2 bg-surface-nav border-b border-border-default">
				<div className="flex rounded-[--radius-md] border border-border-default overflow-hidden self-start">
					<button
						type="button"
						className={`px-3 py-1.5 text-sm font-semibold ${
							mode === "discovery"
								? "bg-accent-primary text-white"
								: "bg-surface-card text-text-secondary"
						}`}
						onClick={() => setMode("discovery")}
					>
						Discovery
					</button>
					<button
						type="button"
						className={`px-3 py-1.5 text-sm font-semibold ${
							mode === "personal"
								? "bg-accent-primary text-white"
								: "bg-surface-card text-text-secondary"
						}`}
						onClick={() => setMode("personal")}
					>
						Personal
					</button>
				</div>

				{mode === "discovery" ? (
					<div className="flex gap-3">
						<FilterCheck
							label="Sport"
							checked={showSport}
							onChange={setShowSport}
						/>
						<FilterCheck
							label="Boulder"
							checked={showBoulder}
							onChange={setShowBoulder}
						/>
					</div>
				) : (
					<div className="flex gap-3">
						<FilterCheck
							label="Sent"
							checked={showSent}
							onChange={setShowSent}
						/>
						<FilterCheck
							label="Project"
							checked={showProject}
							onChange={setShowProject}
						/>
						<FilterCheck
							label="Todo"
							checked={showTodo}
							onChange={setShowTodo}
						/>
					</div>
				)}
			</div>

			{/* Map */}
			<div className="flex-1 relative">
				{isLoading && (
					<div className="absolute inset-0 flex items-center justify-center z-[1000] bg-surface-page/60">
						<Spinner />
					</div>
				)}

				<MapContainer
					center={center}
					zoom={initialZoom}
					className="h-full w-full"
					zoomControl={false}
				>
					<TileLayer
						key={activeLayer.id}
						attribution={activeLayer.attribution}
						url={activeLayer.url}
						errorTileUrl=""
					/>

					<MapControls
						activeLayer={activeLayerId}
						onLayerChange={setActiveLayerId}
					/>

					{mode === "discovery" &&
						allCrags.map((crag) => (
							<Marker
								key={crag.id}
								position={[crag.lat, crag.lng]}
								icon={countIcon(crag.route_count, "#059669")}
							>
								<Popup>
									<button
										type="button"
										className="text-sm font-medium text-accent-primary"
										onClick={() =>
											navigate({
												to: "/crags/$cragId",
												params: { cragId: crag.id },
											})
										}
									>
										<MapPin size={14} className="inline mr-1" />
										{crag.name}
									</button>
								</Popup>
							</Marker>
						))}

					{mode === "personal" &&
						filteredPersonal.map((crag) => (
							<Marker
								key={crag.id}
								position={[crag.lat, crag.lng]}
								icon={countIcon(crag.route_count, "#d97706")}
							>
								<Popup>
									<div className="flex flex-col gap-1">
										<button
											type="button"
											className="text-sm font-medium text-accent-secondary"
											onClick={() =>
												navigate({
													to: "/crags/$cragId",
													params: { cragId: crag.id },
												})
											}
										>
											<MapPin size={14} className="inline mr-1" />
											{crag.name}
										</button>
										<span className="text-xs text-gray-500">
											{crag.climb_count} climb
											{crag.climb_count !== 1 ? "s" : ""}
											{crag.has_sent && " · sent"}
											{crag.has_project && " · project"}
											{crag.has_todo && " · todo"}
										</span>
									</div>
								</Popup>
							</Marker>
						))}
				</MapContainer>

				{!isLoading &&
					((mode === "discovery" && allCrags.length === 0) ||
						(mode === "personal" && filteredPersonal.length === 0)) && (
						<div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
							<p className="text-text-secondary text-sm bg-surface-card/90 px-4 py-2 rounded-[--radius-md]">
								{mode === "discovery"
									? "No downloaded crags with coordinates yet."
									: "No crags with logged climbs found."}
							</p>
						</div>
					)}
			</div>
		</div>
	);
};

export default MapView;
