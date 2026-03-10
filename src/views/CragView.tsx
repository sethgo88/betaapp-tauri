import { useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useWalls } from "@/features/locations/locations.queries";
import { useRoutes } from "@/features/routes/routes.queries";

const RouteList = ({ wallId }: { wallId: string }) => {
	const { data: routes = [] } = useRoutes(wallId);

	if (routes.length === 0) {
		return <p className="text-sm text-stone-500 px-2 py-1">No routes yet</p>;
	}

	return (
		<div className="flex flex-col gap-1 mt-2">
			{routes.map((route) => (
				<div
					key={route.id}
					className="flex items-center justify-between py-2 px-2 rounded-lg bg-stone-700"
				>
					<span className="text-sm">{route.name}</span>
					<div className="flex items-center gap-2">
						<span className="text-xs text-stone-400">{route.grade}</span>
						<span className="text-xs text-stone-500">{route.route_type}</span>
					</div>
				</div>
			))}
		</div>
	);
};

const CragView = () => {
	const { cragId } = useParams({ from: "/crags/$cragId" });
	const router = useRouter();
	const { data: walls = [] } = useWalls(cragId);
	const [selectedWallId, setSelectedWallId] = useState<string | null>(null);

	return (
		<div className="flex flex-col gap-3">
			<button
				type="button"
				className="text-stone-400 text-sm text-left"
				onClick={() => router.history.back()}
			>
				← Back
			</button>

			{walls.length === 0 && (
				<p className="text-stone-400 text-sm">No walls in this crag yet.</p>
			)}

			{walls.map((wall) => (
				<div key={wall.id} className="rounded-lg bg-stone-800 p-4">
					<button
						type="button"
						className="w-full text-left font-medium"
						onClick={() =>
							setSelectedWallId(selectedWallId === wall.id ? null : wall.id)
						}
					>
						{wall.name}
					</button>

					{selectedWallId === wall.id && <RouteList wallId={wall.id} />}
				</div>
			))}
		</div>
	);
};

export default CragView;
