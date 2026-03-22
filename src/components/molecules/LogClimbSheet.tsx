import { useNavigate } from "@tanstack/react-router";
import { Spinner } from "@/components/atoms/Spinner";
import { Sheet } from "@/components/molecules/Sheet";
import {
	useLinkExistingClimbToRoute,
	useUnlinkedClimbs,
} from "@/features/climbs/climbs.queries";
import type { Route } from "@/features/routes/routes.schema";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	route: Route;
};

/**
 * Bottom sheet shown when the user taps "Log this climb" on a route that has
 * no existing log. Offers two paths:
 *   1. New log  — navigate to AddClimbView pre-filled with route data
 *   2. Link existing log — pick from unlinked climbs; backfills location from route hierarchy
 */
export function LogClimbSheet({ isOpen, onClose, route }: Props) {
	const navigate = useNavigate();
	const { data: unlinkedClimbs = [], isLoading } = useUnlinkedClimbs();
	const linkExisting = useLinkExistingClimbToRoute();

	const handleNewLog = () => {
		onClose();
		navigate({
			to: "/climbs/add",
			search: {
				routeId: route.id,
				routeName: route.name,
				grade: route.grade,
				routeType: route.route_type,
			},
		});
	};

	const handleLinkExisting = (climbId: string) => {
		linkExisting.mutate({ climbId, routeId: route.id }, { onSuccess: onClose });
	};

	return (
		<Sheet isOpen={isOpen} onClose={onClose} title="Log this climb">
			<div className="flex flex-col gap-4">
				{/* New log option */}
				<button
					type="button"
					className="rounded-[var(--radius-md)] bg-surface-card border border-card-border p-4 text-left shadow-card"
					onClick={handleNewLog}
				>
					<p className="font-semibold text-text-primary">New log</p>
					<p className="text-sm text-text-secondary mt-0.5">
						Create a new climb entry for this route
					</p>
				</button>

				{/* Link existing log option */}
				<div className="flex flex-col gap-2">
					<p className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
						Link existing log
					</p>

					{isLoading && (
						<div className="flex justify-center py-4">
							<Spinner />
						</div>
					)}

					{!isLoading && unlinkedClimbs.length === 0 && (
						<p className="text-sm text-text-secondary">
							No unlinked climbs to attach.
						</p>
					)}

					{!isLoading && unlinkedClimbs.length > 0 && (
						<ul className="flex flex-col gap-2">
							{unlinkedClimbs.map((climb) => (
								<li key={climb.id}>
									<button
										type="button"
										className="w-full rounded-[var(--radius-md)] bg-surface-card border border-card-border p-4 text-left shadow-card flex items-center justify-between"
										disabled={linkExisting.isPending}
										onClick={() => handleLinkExisting(climb.id)}
									>
										<div>
											<p className="font-medium text-text-primary">
												{climb.name}
											</p>
											<p className="text-sm text-text-secondary capitalize">
												{climb.grade} · {climb.route_type}
											</p>
										</div>
										<span className="text-xs text-text-secondary capitalize">
											{climb.sent_status}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</Sheet>
	);
}
