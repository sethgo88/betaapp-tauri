import { useNavigate, useSearch } from "@tanstack/react-router";
import {
	checkPermissions,
	getCurrentPosition,
	requestPermissions,
} from "@tauri-apps/plugin-geolocation";
import L from "leaflet";
import { Crosshair, Layers, MapPin, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	MapContainer,
	Marker,
	Popup,
	TileLayer,
	useMap,
	useMapEvents,
} from "react-leaflet";
import { Spinner } from "@/components/atoms/Spinner";
import {
	useAllCragsWithCoords,
	useAllWallsWithCoords,
} from "@/features/locations/locations.queries";
import {
	useClimbsAtPin,
	usePersonalCrags,
	usePersonalWalls,
} from "@/features/map/map.queries";
import { cn } from "@/lib/cn";
import { tileLayers } from "@/lib/map-tiles";
import { useUiStore } from "@/stores/ui.store";

// ── Back-button override hook ────────────────────────────────────────────────

function useBackHandlerOverride(handler: (() => void) | null) {
	const setBackHandlerOverride = useUiStore((s) => s.setBackHandlerOverride);
	useEffect(() => {
		setBackHandlerOverride(handler);
		return () => setBackHandlerOverride(null);
	}, [handler, setBackHandlerOverride]);
}

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
					className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] bg-surface-card border border-border-default shadow-sm"
				>
					<Layers size={18} className="text-text-primary" />
				</button>
				{layerPanelOpen && (
					<div className="absolute right-0 top-12 w-36 bg-surface-card border border-border-default rounded-[var(--radius-md)] shadow-md overflow-hidden">
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
				className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] bg-surface-card border border-border-default shadow-sm"
			>
				<Plus size={18} className="text-text-primary" />
			</button>

			{/* Zoom out */}
			<button
				type="button"
				onClick={handleZoomOut}
				className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] bg-surface-card border border-border-default shadow-sm"
			>
				<Minus size={18} className="text-text-primary" />
			</button>

			{/* Center on location */}
			<button
				type="button"
				onClick={handleLocate}
				disabled={locating}
				className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] bg-surface-card border border-border-default shadow-sm"
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

// ── Zoom tracker ────────────────────────────────────────────────────────────

const WALL_ZOOM_THRESHOLD = 15;

const ZoomTracker = ({ onZoom }: { onZoom: (zoom: number) => void }) => {
	const map = useMap();
	useMapEvents({
		zoomend() {
			onZoom(map.getZoom());
		},
	});
	return null;
};

// ── Map click handler (closes sheet when tapping empty map) ─────────────────

const MapClickHandler = ({ onMapClick }: { onMapClick: () => void }) => {
	useMapEvents({ click: () => onMapClick() });
	return null;
};

// ── Zoom-to button (rendered inside a Popup) ────────────────────────────────

const ZoomToButton = ({ lat, lng }: { lat: number; lng: number }) => {
	const map = useMap();
	return (
		<button
			type="button"
			className="text-xs text-text-secondary"
			onClick={() => map.setView([lat, lng], 15)}
		>
			Zoom to crag
		</button>
	);
};

// ── Tile error tracker ───────────────────────────────────────────────────────

const TileErrorBanner = () => {
	const [tileError, setTileError] = useState(false);
	useMapEvents({
		tileerror() {
			setTileError(true);
		},
		layeradd() {
			setTileError(false);
		},
	});

	if (!tileError) return null;
	return (
		<div className="absolute top-3 left-3 z-[1000] bg-surface-card/90 px-3 py-1.5 rounded-[var(--radius-md)] text-xs text-text-secondary pointer-events-none">
			Map tiles unavailable — check your connection
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

// ── Personal pin modal ───────────────────────────────────────────────────────

const SENT_STATUSES = new Set(["sent", "flash", "redpoint", "onsight"]);

type SelectedPin = { type: "crag" | "wall"; id: string; name: string };

const PersonalPinModal = ({
	pin,
	showSent,
	showProject,
	showTodo,
	onClose,
}: {
	pin: SelectedPin;
	showSent: boolean;
	showProject: boolean;
	showTodo: boolean;
	onClose: () => void;
}) => {
	const navigate = useNavigate();
	const { data: climbs = [], isLoading } = useClimbsAtPin(pin.type, pin.id);
	useBackHandlerOverride(onClose);

	const filtered = climbs.filter((c) => {
		if (showSent && SENT_STATUSES.has(c.sent_status)) return true;
		if (showProject && c.sent_status === "project") return true;
		if (showTodo && c.sent_status === "todo") return true;
		return false;
	});

	return (
		<div className="fixed inset-0 z-[2000] flex flex-col justify-end pointer-events-none">
			<div className="bg-surface-card rounded-t-[var(--radius-lg)] max-h-[60dvh] flex flex-col shadow-xl pointer-events-auto">
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0">
					<span className="font-semibold text-text-primary truncate">
						{pin.name}
					</span>
					<button type="button" onClick={onClose} className="ml-2 shrink-0">
						<X size={18} className="text-text-secondary" />
					</button>
				</div>

				{/* List */}
				<div className="overflow-y-auto flex-1 px-4 py-1">
					{isLoading && (
						<div className="flex justify-center py-4">
							<Spinner />
						</div>
					)}
					{!isLoading && filtered.length === 0 && (
						<p className="text-sm text-text-secondary py-4 text-center">
							No climbs match the active filters.
						</p>
					)}
					{!isLoading &&
						filtered.map((climb) => (
							<button
								key={climb.id}
								type="button"
								className="flex items-center justify-between w-full py-3 border-b border-border-default last:border-0 gap-3"
								onClick={() => {
									onClose();
									navigate({
										to: "/climbs/$climbId",
										params: { climbId: climb.id },
									});
								}}
							>
								<span className="text-sm font-medium text-text-primary truncate text-left">
									{climb.name}
								</span>
								<div className="flex items-center gap-2 shrink-0">
									<span className="text-xs text-text-secondary">
										{climb.grade}
									</span>
									<span
										className={cn(
											"text-xs px-1.5 py-0.5 rounded-full font-medium",
											SENT_STATUSES.has(climb.sent_status) &&
												"bg-accent-success/20 text-accent-success",
											climb.sent_status === "project" &&
												"bg-accent-primary/20 text-accent-primary",
											climb.sent_status === "todo" &&
												"bg-text-secondary/20 text-text-secondary",
										)}
									>
										{climb.sent_status.charAt(0).toUpperCase() +
											climb.sent_status.slice(1)}
									</span>
								</div>
							</button>
						))}
				</div>

				<div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
			</div>
		</div>
	);
};

// ── MapView ─────────────────────────────────────────────────────────────────

type Mode = "discovery" | "personal";

const MapView = () => {
	const navigate = useNavigate();
	const userLocation = useUiStore((s) => s.userLocation);
	const {
		lat: searchLat,
		lng: searchLng,
		zoom: searchZoom,
	} = useSearch({ from: "/map" });
	const hasSearchCoords = searchLat != null && searchLng != null;
	const [mode, setMode] = useState<Mode>("discovery");
	const [activeLayerId, setActiveLayerId] = useState("osm");
	const [zoom, setZoom] = useState(hasSearchCoords ? (searchZoom ?? 14) : 6);
	const showWalls = zoom >= WALL_ZOOM_THRESHOLD;

	// Discovery filters
	const [showSport, setShowSport] = useState(true);
	const [showTrad, setShowTrad] = useState(true);
	const [showBoulder, setShowBoulder] = useState(true);

	// Personal filters
	const [showSent, setShowSent] = useState(true);
	const [showProject, setShowProject] = useState(true);
	const [showTodo, setShowTodo] = useState(true);

	const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null);

	const { data: allCrags = [], isLoading: loadingDiscovery } =
		useAllCragsWithCoords();
	const { data: allWalls = [] } = useAllWallsWithCoords();
	const { data: personalCrags = [], isLoading: loadingPersonal } =
		usePersonalCrags();
	const { data: personalWalls = [] } = usePersonalWalls();

	const isLoading = mode === "discovery" ? loadingDiscovery : loadingPersonal;

	const allChecked = showSport && showTrad && showBoulder;

	// Filtered count: sum only the checked discipline counts
	const filteredCount = useCallback(
		(pin: { sport_count: number; trad_count: number; boulder_count: number }) =>
			(showSport ? pin.sport_count : 0) +
			(showTrad ? pin.trad_count : 0) +
			(showBoulder ? pin.boulder_count : 0),
		[showSport, showTrad, showBoulder],
	);

	// Personal filtered count: sum only the checked status counts
	const personalFilteredCount = useCallback(
		(pin: { sent_count: number; project_count: number; todo_count: number }) =>
			(showSent ? pin.sent_count : 0) +
			(showProject ? pin.project_count : 0) +
			(showTodo ? pin.todo_count : 0),
		[showSent, showProject, showTodo],
	);

	// Filter discovery crags/walls by route type.
	// Zero-count pins only show when all three checkboxes are checked.
	const filteredDiscoveryCrags = useMemo(
		() =>
			allCrags.filter((c) => {
				if (!c.has_sport && !c.has_trad && !c.has_boulder) return allChecked;
				if (showSport && c.has_sport) return true;
				if (showTrad && c.has_trad) return true;
				if (showBoulder && c.has_boulder) return true;
				return false;
			}),
		[allCrags, allChecked, showSport, showTrad, showBoulder],
	);

	const filteredDiscoveryWalls = useMemo(
		() =>
			allWalls.filter((w) => {
				if (!w.has_sport && !w.has_trad && !w.has_boulder) return allChecked;
				if (showSport && w.has_sport) return true;
				if (showTrad && w.has_trad) return true;
				if (showBoulder && w.has_boulder) return true;
				return false;
			}),
		[allWalls, allChecked, showSport, showTrad, showBoulder],
	);

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

	// Filter personal walls by active status filters
	const filteredPersonalWalls = useMemo(
		() =>
			personalWalls.filter((w) => {
				if (showSent && w.sent_count > 0) return true;
				if (showProject && w.project_count > 0) return true;
				if (showTodo && w.todo_count > 0) return true;
				return !showSent && !showProject && !showTodo;
			}),
		[personalWalls, showSent, showProject, showTodo],
	);

	// Compute map center — search params override marker-based center
	const center = useMemo<[number, number]>(() => {
		if (hasSearchCoords) return [searchLat, searchLng];
		const items =
			mode === "discovery" ? filteredDiscoveryCrags : filteredPersonal;
		if (items.length === 0)
			return userLocation ? [userLocation.lat, userLocation.lng] : [43.0, 12.0];
		const avgLat = items.reduce((s, c) => s + (c.lat ?? 0), 0) / items.length;
		const avgLng = items.reduce((s, c) => s + (c.lng ?? 0), 0) / items.length;
		return [avgLat, avgLng];
	}, [
		hasSearchCoords,
		searchLat,
		searchLng,
		mode,
		filteredDiscoveryCrags,
		filteredPersonal,
		userLocation,
	]);
	const initialZoom = hasSearchCoords ? (searchZoom ?? 14) : 6;

	// Crags that have walls with coordinates — hide crag pin at high zoom
	const cragsWithWallCoords = useMemo(() => {
		const set = new Set<string>();
		for (const w of filteredDiscoveryWalls) set.add(w.crag_id);
		return set;
	}, [filteredDiscoveryWalls]);

	const personalCragsWithWallCoords = useMemo(() => {
		const set = new Set<string>();
		for (const w of filteredPersonalWalls) set.add(w.crag_id);
		return set;
	}, [filteredPersonalWalls]);

	// At high zoom: show wall pins, hide crag pins for crags that have wall coords
	const visibleCrags = useMemo(
		() =>
			showWalls
				? filteredDiscoveryCrags.filter((c) => !cragsWithWallCoords.has(c.id))
				: filteredDiscoveryCrags,
		[filteredDiscoveryCrags, showWalls, cragsWithWallCoords],
	);

	const visiblePersonalCrags = useMemo(
		() =>
			showWalls
				? filteredPersonal.filter((c) => !personalCragsWithWallCoords.has(c.id))
				: filteredPersonal,
		[filteredPersonal, showWalls, personalCragsWithWallCoords],
	);

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
				<div className="flex rounded-[var(--radius-md)] border border-border-default overflow-hidden self-start">
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
							label="Trad"
							checked={showTrad}
							onChange={setShowTrad}
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

					<ZoomTracker onZoom={setZoom} />
					<MapClickHandler onMapClick={() => setSelectedPin(null)} />
					<TileErrorBanner />

					{/* Crag pins (hidden for crags with wall coords at high zoom) */}
					{mode === "discovery" &&
						visibleCrags.map((crag) => (
							<Marker
								key={crag.id}
								position={[crag.lat, crag.lng]}
								icon={countIcon(filteredCount(crag), "#059669")}
							>
								<Popup>
									<div className="flex flex-col gap-1">
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
										{crag.approach && (
											<p className="text-xs text-gray-500 max-w-[180px]">
												{crag.approach}
											</p>
										)}
										<ZoomToButton lat={crag.lat} lng={crag.lng} />
									</div>
								</Popup>
							</Marker>
						))}

					{/* Wall pins at high zoom */}
					{mode === "discovery" &&
						showWalls &&
						filteredDiscoveryWalls.map((wall) => (
							<Marker
								key={wall.id}
								position={[wall.lat, wall.lng]}
								icon={countIcon(filteredCount(wall), "#eab308")}
							>
								<Popup>
									<div className="flex flex-col gap-0.5">
										<button
											type="button"
											className="text-sm font-medium text-yellow-500"
											onClick={() =>
												navigate({
													to: "/walls/$wallId",
													params: { wallId: wall.id },
												})
											}
										>
											<MapPin size={14} className="inline mr-1" />
											{wall.name}
										</button>
										<span className="text-xs text-gray-500">
											{wall.crag_name}
										</span>
										{wall.approach && (
											<p className="text-xs text-gray-500 max-w-[180px]">
												{wall.approach}
											</p>
										)}
									</div>
								</Popup>
							</Marker>
						))}

					{/* Personal crag pins */}
					{mode === "personal" &&
						visiblePersonalCrags.map((crag) => (
							<Marker
								key={crag.id}
								position={[crag.lat, crag.lng]}
								icon={countIcon(personalFilteredCount(crag), "#d97706")}
								eventHandlers={{
									click: () =>
										setSelectedPin((prev) =>
											prev?.id === crag.id && prev?.type === "crag"
												? null
												: { type: "crag", id: crag.id, name: crag.name },
										),
								}}
							/>
						))}

					{/* Personal wall pins at high zoom */}
					{mode === "personal" &&
						showWalls &&
						filteredPersonalWalls.map((wall) => (
							<Marker
								key={wall.id}
								position={[wall.lat, wall.lng]}
								icon={countIcon(personalFilteredCount(wall), "#eab308")}
								eventHandlers={{
									click: () =>
										setSelectedPin((prev) =>
											prev?.id === wall.id && prev?.type === "wall"
												? null
												: { type: "wall", id: wall.id, name: wall.name },
										),
								}}
							/>
						))}
				</MapContainer>

				{!isLoading &&
					((mode === "discovery" && filteredDiscoveryCrags.length === 0) ||
						(mode === "personal" && filteredPersonal.length === 0)) && (
						<div className="absolute inset-0 flex items-center justify-center z-[1000] pointer-events-none">
							<p className="text-text-secondary text-sm bg-surface-card/90 px-4 py-2 rounded-[var(--radius-md)]">
								{mode === "discovery"
									? "No downloaded crags with coordinates yet."
									: "No crags with logged climbs found."}
							</p>
						</div>
					)}

				{selectedPin && (
					<PersonalPinModal
						pin={selectedPin}
						showSent={showSent}
						showProject={showProject}
						showTodo={showTodo}
						onClose={() => setSelectedPin(null)}
					/>
				)}
			</div>
		</div>
	);
};

export default MapView;
