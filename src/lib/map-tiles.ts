import { Layers, Mountain, Satellite } from "lucide-react";

export type TileLayerDef = {
	id: string;
	name: string;
	url: string;
	attribution: string;
	icon: typeof Layers;
};

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
		id: "topo",
		name: "Topo",
		url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
		attribution:
			'&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
		icon: Mountain,
	},
	{
		id: "satellite",
		name: "Satellite",
		url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
		attribution:
			'&copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics',
		icon: Satellite,
	},
];
