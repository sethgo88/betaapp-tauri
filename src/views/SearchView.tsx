import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/atoms/Input";
import { useSearchLocations } from "@/features/locations/locations.queries";
import { useSearchLocalRoutes } from "@/features/routes/routes.queries";

const SearchView = () => {
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [showLocations, setShowLocations] = useState(true);
	const [showRoutes, setShowRoutes] = useState(true);

	const { data: locations = [] } = useSearchLocations(query);
	const { data: routes = [] } = useSearchLocalRoutes(query);

	const navigateToLocation = (
		id: string,
		kind: "sub_region" | "crag" | "wall",
	) => {
		if (kind === "sub_region") {
			navigate({
				to: "/sub-regions/$subRegionId",
				params: { subRegionId: id },
			});
		} else if (kind === "crag") {
			navigate({ to: "/crags/$cragId", params: { cragId: id } });
		} else {
			navigate({ to: "/walls/$wallId", params: { wallId: id } });
		}
	};

	const kindLabel = (kind: "sub_region" | "crag" | "wall") => {
		if (kind === "sub_region") return "Area";
		if (kind === "crag") return "Crag";
		return "Wall";
	};

	return (
		<div className="flex flex-col gap-3">
			<Input
				placeholder="Search locations & routes…"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
			/>

			<div className="flex gap-4">
				<label className="flex items-center gap-2 text-sm cursor-pointer">
					<input
						type="checkbox"
						checked={showLocations}
						onChange={() => setShowLocations(!showLocations)}
						className="accent-accent-primary w-4 h-4"
					/>
					<span>Locations</span>
				</label>
				<label className="flex items-center gap-2 text-sm cursor-pointer">
					<input
						type="checkbox"
						checked={showRoutes}
						onChange={() => setShowRoutes(!showRoutes)}
						className="accent-accent-primary w-4 h-4"
					/>
					<span>Routes</span>
				</label>
			</div>

			{query.length < 2 && (
				<p className="text-white/70 text-sm text-center pt-8">
					Type at least 2 characters to search
				</p>
			)}

			{query.length >= 2 && showLocations && (
				<div>
					<p className="text-xs text-white uppercase tracking-wide mb-2">
						Locations
					</p>
					{locations.length === 0 ? (
						<p className="text-white/70 text-sm">No matching locations</p>
					) : (
						<div className="flex flex-col gap-1">
							{locations.map((loc) => (
								<button
									key={`${loc.kind}-${loc.id}`}
									type="button"
									className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-card hover:bg-surface-hover text-left"
									onClick={() => navigateToLocation(loc.id, loc.kind)}
								>
									<span className="text-sm">{loc.name}</span>
									<span className="text-xs text-text-on-light">
										{kindLabel(loc.kind)}
									</span>
								</button>
							))}
						</div>
					)}
				</div>
			)}

			{query.length >= 2 && showRoutes && (
				<div>
					<p className="text-xs text-white uppercase tracking-wide mb-2">
						Routes
					</p>
					{routes.length === 0 ? (
						<p className="text-white/70 text-sm">No matching routes</p>
					) : (
						<div className="flex flex-col gap-1">
							{routes.map((route) => (
								<button
									key={route.id}
									type="button"
									className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-card hover:bg-surface-hover text-left"
									onClick={() =>
										navigate({
											to: "/routes/$routeId",
											params: { routeId: route.id },
										})
									}
								>
									<span className="text-sm">{route.name}</span>
									<div className="flex items-center gap-2">
										<span className="text-xs text-text-on-light">
											{route.grade}
										</span>
										<span className="text-xs text-text-on-light">
											{route.route_type}
										</span>
									</div>
								</button>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default SearchView;
