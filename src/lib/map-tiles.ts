import { Layers, Satellite } from "lucide-react";

export type TileLayerDef = {
	id: string;
	name: string;
	url: string;
	attribution: string;
	icon: typeof Layers;
};

const stadiaApiKey = import.meta.env.VITE_STADIA_API_KEY as string;

export const tileLayers: TileLayerDef[] = [
	{
		id: "osm",
		name: "Street",
		url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
		attribution:
			'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		icon: Layers,
	},
	{
		id: "satellite",
		name: "Satellite",
		url: `https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg?api_key=${stadiaApiKey}`,
		attribution:
			'&copy; CNES, Distribution Airbus DS, © Airbus DS, © PlanetObserver (Contains Copernicus Data) | &copy; <a href="https://www.stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		icon: Satellite,
	},
];
