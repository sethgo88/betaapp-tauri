import { useState } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import {
	LocationDrillDown,
	type LocationSelection,
} from "@/components/molecules/LocationDrillDown";
import { Sheet } from "@/components/molecules/Sheet";
import { useRoutes } from "@/features/routes/routes.queries";
import type { Route } from "@/features/routes/routes.schema";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (route: Route) => void;
};

export function RoutePickerSheet({ isOpen, onClose, onSelect }: Props) {
	const [wallId, setWallId] = useState<string | null>(null);

	const { data: routes = [], isLoading } = useRoutes(wallId);
	const verifiedRoutes = routes.filter((r) => r.status === "verified");

	const handleLocationChange = (selection: LocationSelection) => {
		setWallId(selection.wallId);
	};

	const handleSelect = (route: Route) => {
		onSelect(route);
		onClose();
	};

	return (
		<Sheet isOpen={isOpen} onClose={onClose} title="Link to route">
			<div className="flex flex-col gap-4">
				<LocationDrillDown onChange={handleLocationChange} />

				{wallId && isLoading && (
					<div className="flex justify-center py-4">
						<Spinner />
					</div>
				)}

				{wallId && !isLoading && verifiedRoutes.length === 0 && (
					<p className="text-sm text-text-secondary">
						No verified routes on this wall.
					</p>
				)}

				{wallId && !isLoading && verifiedRoutes.length > 0 && (
					<div className="flex flex-col gap-2">
						{verifiedRoutes.map((route) => (
							<button
								key={route.id}
								type="button"
								className="rounded-card bg-surface-card p-4 text-left flex items-center justify-between"
								onClick={() => handleSelect(route)}
							>
								<span className="font-medium text-text-primary">
									{route.name}
								</span>
								<div className="flex items-center gap-2">
									<span className="text-sm text-text-secondary">
										{route.grade}
									</span>
									<span className="text-xs text-text-muted capitalize">
										{route.route_type}
									</span>
								</div>
							</button>
						))}
					</div>
				)}
			</div>
		</Sheet>
	);
}
