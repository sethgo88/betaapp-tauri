import {
	checkPermissions,
	getCurrentPosition,
	requestPermissions,
} from "@tauri-apps/plugin-geolocation";
import { Check, Crosshair, Layers, Minus, Plus, X } from "lucide-react";
import { useCallback, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { tileLayers } from "@/lib/map-tiles";

type Coords = { lat: number; lng: number };

// ── Track map center on move ────────────────────────────────────────────────

function CenterTracker({ onMove }: { onMove: (coords: Coords) => void }) {
	const map = useMap();
	useMapEvents({
		moveend() {
			const c = map.getCenter();
			onMove({ lat: c.lat, lng: c.lng });
		},
	});
	return null;
}

// ── Map controls ────────────────────────────────────────────────────────────

function MapControls({
	activeLayerId,
	onLayerChange,
}: {
	activeLayerId: string;
	onLayerChange: (id: string) => void;
}) {
	const map = useMap();
	const [layerPanelOpen, setLayerPanelOpen] = useState(false);
	const [locating, setLocating] = useState(false);

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
			if (perms.location !== "granted") return;
			const pos = await getCurrentPosition();
			map.flyTo([pos.coords.latitude, pos.coords.longitude], 14);
		} catch {
			// permission denied or unavailable
		} finally {
			setLocating(false);
		}
	}, [map]);

	return (
		<div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
			{/* Layers */}
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
									activeLayerId === layer.id
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

			{/* Zoom */}
			<button
				type="button"
				onClick={() => map.zoomIn()}
				className="flex items-center justify-center w-10 h-10 rounded-[--radius-md] bg-surface-card border border-border-default shadow-sm"
			>
				<Plus size={18} className="text-text-primary" />
			</button>
			<button
				type="button"
				onClick={() => map.zoomOut()}
				className="flex items-center justify-center w-10 h-10 rounded-[--radius-md] bg-surface-card border border-border-default shadow-sm"
			>
				<Minus size={18} className="text-text-primary" />
			</button>

			{/* Locate */}
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
}

// ── Fixed center pin (CSS overlay, not a Leaflet marker) ────────────────────

const PIN_DATA_URI =
	"data:image/svg+xml," +
	encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="#d97706"/><circle cx="14" cy="14" r="6" fill="white"/></svg>',
	);

function CenterPin() {
	return (
		<div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
			<img
				src={PIN_DATA_URI}
				alt=""
				width={28}
				height={40}
				className="drop-shadow-md"
				style={{ marginBottom: 40 }}
			/>
		</div>
	);
}

// ── Full-screen picker overlay ──────────────────────────────────────────────

interface CoordinatePickerProps {
	value?: Coords | null;
	onChange: (coords: Coords) => void;
	onClose?: () => void;
}

export const CoordinatePicker = ({
	value,
	onChange,
	onClose,
}: CoordinatePickerProps) => {
	const initial: Coords = value ?? { lat: 39.0, lng: -98.0 };
	const [coords, setCoords] = useState<Coords>(initial);
	const [activeLayerId, setActiveLayerId] = useState("osm");

	const activeLayer =
		tileLayers.find((l) => l.id === activeLayerId) ?? tileLayers[0];

	const handleConfirm = () => {
		onChange(coords);
		onClose?.();
	};

	return (
		<div className="fixed inset-0 z-[1500] flex flex-col bg-surface-page">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 bg-surface-nav border-b border-border-default pt-[env(safe-area-inset-top)]">
				<button type="button" onClick={onClose} className="text-text-secondary">
					<X size={22} />
				</button>
				<h2 className="font-display font-semibold text-text-primary">
					Pick Location
				</h2>
				<div className="w-[22px]" />
			</div>

			{/* Map + fixed center pin */}
			<div className="flex-1 relative">
				<MapContainer
					center={[initial.lat, initial.lng]}
					zoom={value ? 12 : 4}
					className="h-full w-full"
					zoomControl={false}
				>
					<TileLayer
						key={activeLayer.id}
						attribution={activeLayer.attribution}
						url={activeLayer.url}
					/>
					<CenterTracker onMove={setCoords} />
					<MapControls
						activeLayerId={activeLayerId}
						onLayerChange={setActiveLayerId}
					/>
				</MapContainer>

				<CenterPin />
			</div>

			{/* Bottom bar */}
			<div className="px-4 py-3 bg-surface-nav border-t border-border-default pb-[env(safe-area-inset-bottom)]">
				<p className="text-xs text-text-secondary text-center mb-2">
					{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
				</p>
				<button
					type="button"
					onClick={handleConfirm}
					className="w-full flex items-center justify-center gap-2 py-3 rounded-[--radius-md] bg-accent-primary hover:bg-accent-primary/90 font-semibold text-white"
				>
					<Check size={18} />
					Confirm Location
				</button>
			</div>
		</div>
	);
};
