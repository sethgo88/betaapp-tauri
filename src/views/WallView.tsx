import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { EditableDescription } from "@/components/molecules/EditableDescription";
import { useAuthStore } from "@/features/auth/auth.store";
import {
	useUpdateLocationDescription,
	useWall,
} from "@/features/locations/locations.queries";
import { useRoutes } from "@/features/routes/routes.queries";

const WallView = () => {
	const { wallId } = useParams({ from: "/walls/$wallId" });
	const navigate = useNavigate();
	const { data: wall, isLoading } = useWall(wallId);
	const { data: routes = [] } = useRoutes(wallId);
	const updateDescription = useUpdateLocationDescription();
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	if (!wall) {
		return <p className="text-text-secondary text-center pt-12">Not found</p>;
	}

	return (
		<div className="flex flex-col gap-3">
			<button
				type="button"
				className="text-text-secondary text-sm text-left"
				onClick={() =>
					navigate({
						to: "/crags/$cragId",
						params: { cragId: wall.crag_id },
					})
				}
			>
				← Back to crag
			</button>

			<h1 className="text-xl font-bold">{wall.name}</h1>

			<EditableDescription
				description={wall.description}
				isAdmin={isAdmin}
				onSave={async (description) => {
					await updateDescription.mutateAsync({
						table: "walls",
						id: wallId,
						description,
					});
				}}
			/>

			{routes.length === 0 && (
				<p className="text-text-secondary text-sm">
					No routes on this wall yet.
				</p>
			)}

			{routes.map((route) => (
				<button
					key={route.id}
					type="button"
					disabled={route.status === "pending"}
					className="rounded-lg bg-surface-card p-4 text-left flex items-center justify-between disabled:opacity-60"
					onClick={() =>
						navigate({
							to: "/routes/$routeId",
							params: { routeId: route.id },
						})
					}
				>
					<span className="font-medium">{route.name}</span>
					<div className="flex items-center gap-2">
						<span className="text-xs text-text-secondary">{route.grade}</span>
						<span className="text-xs text-text-tertiary">
							{route.route_type}
						</span>
						{route.status === "pending" && (
							<span className="text-xs text-amber-400">pending</span>
						)}
					</div>
				</button>
			))}

			<Button
				type="button"
				variant="secondary"
				size="small"
				onClick={() =>
					navigate({
						to: "/routes/submit",
						search: { wallId: wall.id, wallName: wall.name },
					})
				}
			>
				Submit a route
			</Button>
		</div>
	);
};

export default WallView;
