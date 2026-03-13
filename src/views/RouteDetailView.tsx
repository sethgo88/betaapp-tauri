import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { EditableDescription } from "@/components/molecules/EditableDescription";
import { useAuthStore } from "@/features/auth/auth.store";
import { useClimbs } from "@/features/climbs/climbs.queries";
import {
	useRoute,
	useUpdateRouteDescription,
} from "@/features/routes/routes.queries";

const RouteDetailView = () => {
	const { routeId } = useParams({ from: "/routes/$routeId" });
	const navigate = useNavigate();
	const { data: route, isLoading } = useRoute(routeId);
	const { data: climbs = [] } = useClimbs();
	const updateDescription = useUpdateRouteDescription();
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");
	const existingClimb = climbs.find((c) => c.route_id === routeId);

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	if (!route) {
		return (
			<p className="text-text-secondary text-center pt-12">Route not found</p>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<button
				type="button"
				className="text-text-secondary text-sm text-left"
				onClick={() =>
					navigate({
						to: "/walls/$wallId",
						params: { wallId: route.wall_id },
					})
				}
			>
				← Back to wall
			</button>

			<div>
				<h1 className="text-xl font-bold">{route.name}</h1>
				<div className="flex items-center gap-2 mt-1">
					<span className="text-text-secondary">{route.grade}</span>
					<span className="text-xs px-2 py-0.5 rounded-full bg-surface-page text-text-secondary">
						{route.route_type}
					</span>
				</div>
			</div>

			<EditableDescription
				description={route.description}
				isAdmin={isAdmin}
				onSave={async (description) => {
					await updateDescription.mutateAsync({
						id: routeId,
						description,
					});
				}}
			/>

			{/* Placeholder for route image — wired in by #11 */}

			{existingClimb ? (
				<Button
					type="button"
					variant="primary"
					onClick={() =>
						navigate({
							to: "/climbs/$climbId",
							params: { climbId: existingClimb.id },
						})
					}
				>
					View log
				</Button>
			) : (
				<Button
					type="button"
					variant="primary"
					onClick={() =>
						navigate({
							to: "/climbs/add",
							search: {
								routeId: route.id,
								routeName: route.name,
								grade: route.grade,
								routeType: route.route_type,
							},
						})
					}
				>
					Log this climb
				</Button>
			)}
		</div>
	);
};

export default RouteDetailView;
