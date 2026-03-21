import { useNavigate, useParams } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Spinner } from "@/components/atoms/Spinner";
import { AdminImageGallery } from "@/components/molecules/AdminImageGallery";
import { EditableDescription } from "@/components/molecules/EditableDescription";
import { RouteBodyChart } from "@/components/molecules/RouteBodyChart";
import { TopoModal } from "@/components/molecules/TopoModal";
import { RouteTopoViewer } from "@/components/molecules/TopoViewer";
import { RouteTopoBuilder } from "@/components/organisms/TopoBuilder";
import { useAuthStore } from "@/features/auth/auth.store";
import { useClimbs } from "@/features/climbs/climbs.queries";
import {
	useAddRouteImage,
	useDeleteRouteImage,
	useRouteImages,
} from "@/features/route-images/route-images.queries";
import {
	useAddRouteLink,
	useDeleteRouteLink,
	useRoute,
	useRouteLinks,
	useUpdateRouteDescription,
} from "@/features/routes/routes.queries";
import { RouteLinkSubmitSchema } from "@/features/routes/routes.schema";
import {
	useRouteTopo,
	useWallTopo,
	useWallTopoLines,
} from "@/features/topos/topos.queries";

const RouteDetailView = () => {
	const { routeId } = useParams({ from: "/routes/$routeId" });
	const navigate = useNavigate();
	const { data: route, isLoading } = useRoute(routeId);
	const { data: climbs = [] } = useClimbs();
	const { data: routeImages = [] } = useRouteImages(routeId);
	const { data: routeLinks = [] } = useRouteLinks(routeId);
	const updateDescription = useUpdateRouteDescription();
	const addRouteImage = useAddRouteImage(routeId);
	const deleteRouteImage = useDeleteRouteImage(routeId);
	const addRouteLink = useAddRouteLink(routeId);
	const deleteRouteLink = useDeleteRouteLink(routeId);
	const user = useAuthStore((s) => s.user);
	const isAdmin = user?.role === "admin";
	const existingClimb = climbs.find((c) => c.route_id === routeId);

	// Topo data
	const { data: routeTopo = null } = useRouteTopo(routeId);
	const { data: wallTopo = null } = useWallTopo(route?.wall_id ?? null);
	const { data: wallTopoLines = [] } = useWallTopoLines(wallTopo?.id ?? null);
	const wallTopoLineForRoute = wallTopoLines.find(
		(l) => l.route_id === routeId,
	);
	const showWallTopoFallback =
		!routeTopo && !!wallTopo && !!wallTopoLineForRoute;
	const [showTopoModal, setShowTopoModal] = useState(false);
	const [showTopoEdit, setShowTopoEdit] = useState(false);

	const [linkUrl, setLinkUrl] = useState("");
	const [linkTitle, setLinkTitle] = useState("");
	const [linkError, setLinkError] = useState<string | null>(null);

	const userLinkCount = routeLinks.filter((l) => l.user_id === user?.id).length;
	const atLinkLimit = userLinkCount >= 5;

	const handleAddLink = () => {
		if (atLinkLimit) return;
		const result = RouteLinkSubmitSchema.safeParse({
			url: linkUrl,
			title: linkTitle || undefined,
		});
		if (!result.success) {
			setLinkError(result.error.issues[0]?.message ?? "Invalid input");
			return;
		}
		setLinkError(null);
		addRouteLink.mutate(
			{
				url: result.data.url,
				title: result.data.title,
				userId: user?.id ?? "",
			},
			{
				onSuccess: () => {
					setLinkUrl("");
					setLinkTitle("");
				},
			},
		);
	};

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
				<h1 className="text-xl font-display font-bold">{route.name}</h1>
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

			<AdminImageGallery
				images={routeImages}
				isAdmin={isAdmin ?? false}
				onAdd={(file) => addRouteImage.mutate(file)}
				onDelete={(id, imageUrl) => deleteRouteImage.mutate({ id, imageUrl })}
				isAdding={addRouteImage.isPending}
			/>

			{/* Topo section */}
			{(routeTopo || showWallTopoFallback) && (
				<div className="flex flex-col gap-1">
					<p className="text-xs text-text-tertiary">Topo</p>
					<button
						type="button"
						onClick={() => setShowTopoModal(true)}
						className="relative w-full max-h-[300px] rounded-[var(--radius-md)] overflow-hidden"
						aria-label="View topo"
					>
						{routeTopo ? (
							<RouteTopoViewer topo={routeTopo} />
						) : (
							<div className="relative w-full">
								<img
									src={wallTopo?.image_url}
									alt="Route topo"
									className="w-full"
									draggable={false}
								/>
								{wallTopoLineForRoute &&
									wallTopoLineForRoute.points.length >= 2 && (
										<svg
											className="absolute inset-0 w-full h-full"
											viewBox="0 0 100 100"
											preserveAspectRatio="none"
											aria-hidden="true"
											style={{ pointerEvents: "none" }}
										>
											<polyline
												points={wallTopoLineForRoute.points
													.map((p) => `${p.x_pct * 100},${p.y_pct * 100}`)
													.join(" ")}
												stroke={wallTopoLineForRoute.color}
												strokeWidth="2"
												fill="none"
												strokeLinecap="round"
												strokeLinejoin="round"
												vectorEffect="non-scaling-stroke"
											/>
										</svg>
									)}
							</div>
						)}
						<span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white text-xs font-medium">
							View topo
						</span>
					</button>
				</div>
			)}

			{isAdmin && (
				<button
					type="button"
					onClick={() => setShowTopoEdit(true)}
					className="text-sm text-accent-primary text-left"
				>
					{routeTopo ? "Edit topo" : "+ Add route topo"}
				</button>
			)}
			{showTopoEdit && (
				<RouteTopoBuilder
					routeId={routeId}
					topo={routeTopo}
					onClose={() => setShowTopoEdit(false)}
				/>
			)}

			{showTopoModal && routeTopo && (
				<TopoModal
					mode="route"
					topo={routeTopo}
					onClose={() => setShowTopoModal(false)}
				/>
			)}

			{showTopoModal &&
				showWallTopoFallback &&
				wallTopo &&
				wallTopoLineForRoute && (
					<TopoModal
						mode="wall-single"
						topo={wallTopo}
						lines={wallTopoLines}
						routes={
							route
								? [{ id: route.id, name: route.name, grade: route.grade }]
								: []
						}
						routeId={routeId}
						onClose={() => setShowTopoModal(false)}
					/>
				)}

			{/* Links section */}
			<div className="flex flex-col gap-2">
				<h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
					Links
				</h2>

				{routeLinks.length > 0 && (
					<ul className="flex flex-col gap-1">
						{routeLinks.map((link) => (
							<li
								key={link.id}
								className="flex items-center justify-between gap-2 py-2 border-b border-border-subtle"
							>
								<button
									type="button"
									className="flex items-center gap-2 text-sm text-accent-primary min-w-0"
									onClick={() => openUrl(link.url)}
								>
									<ExternalLink size={14} className="shrink-0" />
									<span className="truncate">{link.title ?? link.url}</span>
								</button>

								{(isAdmin || link.user_id === user?.id) && (
									<button
										type="button"
										className="shrink-0 text-text-secondary"
										onClick={() => deleteRouteLink.mutate(link.id)}
										disabled={deleteRouteLink.isPending}
									>
										<Trash2 size={14} />
									</button>
								)}
							</li>
						))}
					</ul>
				)}

				{atLinkLimit ? (
					<p className="text-xs text-text-muted">
						You've reached the limit of 5 links per route.
					</p>
				) : (
					<div className="flex flex-col gap-2">
						<Input
							placeholder="https://..."
							value={linkUrl}
							onChange={(e) => setLinkUrl(e.target.value)}
						/>
						<Input
							placeholder="Title (optional)"
							value={linkTitle}
							onChange={(e) => setLinkTitle(e.target.value)}
						/>
						{linkError && <p className="text-xs text-red-400">{linkError}</p>}
						<Button
							type="button"
							variant="secondary"
							onClick={handleAddLink}
							disabled={addRouteLink.isPending || !linkUrl}
						>
							{addRouteLink.isPending ? "Adding..." : "Add link"}
						</Button>
					</div>
				)}
			</div>

			<RouteBodyChart routeId={routeId} routeType={route.route_type} />

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
