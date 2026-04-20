import { useNavigate, useParams } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Spinner } from "@/components/atoms/Spinner";
import { StarRating } from "@/components/atoms/StarRating";
import { TagPill } from "@/components/atoms/TagPill";
import { AddLinkModal } from "@/components/molecules/AddLinkModal";
import { AdminImageGallery } from "@/components/molecules/AdminImageGallery";
import { ConfirmDeleteDialog } from "@/components/molecules/ConfirmDeleteDialog";
import { EditableDescription } from "@/components/molecules/EditableDescription";
import { LogClimbSheet } from "@/components/molecules/LogClimbSheet";
import { RouteBodyChart } from "@/components/molecules/RouteBodyChart";
import { SunShadeSheet } from "@/components/molecules/SunShadeSheet";
import { SunShadeSummary } from "@/components/molecules/SunShadeSummary";
import { TagSelect } from "@/components/molecules/TagSelect";
import { TopoModal } from "@/components/molecules/TopoModal";
import { RouteTopoViewer } from "@/components/molecules/TopoViewer";
import { RouteTopoBuilder } from "@/components/organisms/TopoBuilder";
import { useAuthStore } from "@/features/auth/auth.store";
import { useClimbs } from "@/features/climbs/climbs.queries";
import { useGrades } from "@/features/grades/grades.queries";
import { useWall } from "@/features/locations/locations.queries";
import {
	useAddRouteImage,
	useDeleteRouteImage,
	useRouteImages,
	useWallImages,
} from "@/features/route-images/route-images.queries";
import {
	useAddRouteLink,
	useDeleteRouteLink,
	useRoute,
	useRouteLinks,
	useUpdateRouteDescription,
	useUpdateRouteFields,
	useUpdateRouteSunData,
} from "@/features/routes/routes.queries";
import { useRouteTags, useSetRouteTags } from "@/features/tags/tags.queries";
import type { Tag } from "@/features/tags/tags.schema";
import {
	useRouteTopo,
	useWallTopo,
	useWallTopoLines,
} from "@/features/topos/topos.queries";
import { getEffectiveSunData } from "@/lib/sun";

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
	const [pendingDeleteLinkId, setPendingDeleteLinkId] = useState<string | null>(
		null,
	);

	// Topo data
	const { data: wallImages = [] } = useWallImages(route?.wall_id ?? "");
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

	const updateRouteFields = useUpdateRouteFields();
	const { data: routeTags = [] } = useRouteTags(routeId);
	const setRouteTags = useSetRouteTags(routeId);
	const [pendingTags, setPendingTags] = useState<Tag[]>([]);
	const [editingMeta, setEditingMeta] = useState(false);
	const [editName, setEditName] = useState("");
	const [editRouteType, setEditRouteType] = useState<
		"sport" | "boulder" | "trad"
	>("sport");
	const [editGrade, setEditGrade] = useState("");
	const { data: editGrades = [] } = useGrades(editRouteType);

	const handleOpenMetaEdit = () => {
		if (!route) return;
		setEditName(route.name);
		setEditRouteType(route.route_type);
		setEditGrade(route.grade);
		setPendingTags(routeTags);
		setEditingMeta(true);
	};

	const handleSaveMeta = () => {
		if (!route) return;
		const resolvedGrade =
			editGrade || (editGrades.length > 0 ? editGrades[0].grade : "");
		updateRouteFields.mutate(
			{
				id: routeId,
				values: {
					name: editName.trim(),
					grade: resolvedGrade,
					route_type: editRouteType,
					description: route.description ?? undefined,
				},
			},
			{
				onSuccess: () => {
					setRouteTags.mutate(pendingTags.map((t) => t.id));
					setEditingMeta(false);
				},
			},
		);
	};

	const [showLogSheet, setShowLogSheet] = useState(false);
	const [showAddLinkModal, setShowAddLinkModal] = useState(false);
	const [sunSheetOpen, setSunSheetOpen] = useState(false);

	// Sun/shade
	const { data: wall } = useWall(route?.wall_id ?? null);
	const updateRouteSunData = useUpdateRouteSunData(routeId);

	const userLinkCount = routeLinks.filter((l) => l.user_id === user?.id).length;
	const atLinkLimit = userLinkCount >= 5;

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	if (!route) {
		return <p className="text-white text-center pt-12">Route not found</p>;
	}

	const effectiveSunData = getEffectiveSunData(route, wall ?? {});

	return (
		<div className="flex flex-col gap-4">
			{editingMeta ? (
				<div className="flex flex-col gap-2 rounded-lg bg-surface-card p-4">
					<Input
						placeholder="Route name"
						value={editName}
						onChange={(e) => setEditName(e.target.value)}
					/>
					<Select
						value={editRouteType}
						onChange={(e) => {
							const val = e.target.value as "sport" | "boulder" | "trad";
							setEditRouteType(val);
							setEditGrade("");
						}}
					>
						<option value="sport">Sport</option>
						<option value="boulder">Boulder</option>
						<option value="trad">Trad</option>
					</Select>
					<Select
						value={
							editGrade || (editGrades.length > 0 ? editGrades[0].grade : "")
						}
						onChange={(e) => setEditGrade(e.target.value)}
					>
						{editGrades.map((g) => (
							<option key={g.id} value={g.grade}>
								{g.grade}
							</option>
						))}
					</Select>
					<TagSelect value={pendingTags} onChange={setPendingTags} />
					<div className="flex gap-2">
						<Button
							type="button"
							variant="primary"
							size="small"
							onClick={handleSaveMeta}
							disabled={updateRouteFields.isPending || !editName.trim()}
						>
							{updateRouteFields.isPending ? "Saving…" : "Save"}
						</Button>
						<Button
							type="button"
							variant="secondary"
							size="small"
							onClick={() => setEditingMeta(false)}
						>
							Cancel
						</Button>
					</div>
				</div>
			) : (
				<div>
					<div className="flex items-start justify-between gap-2">
						<h1 className="text-xl font-display font-bold text-white">
							{route.name}
						</h1>
						{isAdmin && (
							<button
								type="button"
								onClick={handleOpenMetaEdit}
								className="text-xs text-text-light-on-dark-secondary hover:text-text-on-dark shrink-0 mt-1"
							>
								Edit
							</button>
						)}
					</div>
					<div className="flex items-center gap-2 mt-1">
						<span className="text-white">{route.grade}</span>
						<span className="text-xs px-2 py-0.5 rounded-full bg-surface-page text-text-primary">
							{route.route_type}
						</span>
					</div>
					{routeTags.length > 0 && (
						<div className="flex flex-wrap gap-1.5 mt-2">
							{routeTags.map((tag) => (
								<TagPill key={tag.id} name={tag.name} />
							))}
						</div>
					)}
					{route.avg_rating != null && (
						<div className="flex items-center gap-2 mt-2">
							<StarRating value={Math.round(route.avg_rating)} readOnly />
							<span className="text-xs text-white">
								{route.avg_rating.toFixed(1)} · {route.rating_count ?? 0}{" "}
								{(route.rating_count ?? 0) === 1 ? "vote" : "votes"}
							</span>
						</div>
					)}
					<div className="mt-2">
						<SunShadeSummary
							data={effectiveSunData}
							onClick={() => setSunSheetOpen(true)}
						/>
					</div>
				</div>
			)}

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
					<p className="text-xs text-white">Topo</p>
					<button
						type="button"
						onClick={() => setShowTopoModal(true)}
						className="relative max-w-1/2 max-h-75 rounded-[var(--radius-md)] overflow-hidden"
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
					</button>
				</div>
			)}

			{isAdmin && (
				<button
					type="button"
					onClick={() => setShowTopoEdit(true)}
					className="text-sm text-text-light-on-dark-secondary hover:text-text-on-dark text-left"
				>
					{routeTopo ? "Edit topo" : "+ Add route topo"}
				</button>
			)}
			{showTopoEdit && (
				<RouteTopoBuilder
					routeId={routeId}
					topo={routeTopo}
					galleryImages={wallImages}
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
								? [
										{
											id: route.id,
											name: route.name,
											grade: route.grade,
											route_type: route.route_type,
										},
									]
								: []
						}
						routeId={routeId}
						onClose={() => setShowTopoModal(false)}
					/>
				)}

			{/* Links section */}
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-white uppercase tracking-wide">
						Links
					</h2>
					{!atLinkLimit && (
						<button
							type="button"
							className="flex items-center gap-1 text-sm text-text-light-on-dark-secondary hover:text-text-on-dark"
							onClick={() => setShowAddLinkModal(true)}
						>
							<Plus size={14} />
							Add link
						</button>
					)}
				</div>

				{routeLinks.length > 0 && (
					<ul className="flex flex-col gap-1">
						{routeLinks.map((link) => (
							<li
								key={link.id}
								className="flex items-center justify-between gap-2 py-2 border-b border-border-subtle"
							>
								<button
									type="button"
									className="flex items-center gap-2 text-sm text-text-light-on-dark-secondary hover:text-text-on-dark min-w-0"
									onClick={() => openUrl(link.url)}
								>
									<ExternalLink size={14} className="shrink-0" />
									<span className="truncate">{link.title ?? link.url}</span>
								</button>

								{(isAdmin || link.user_id === user?.id) && (
									<button
										type="button"
										className="shrink-0 text-white"
										onClick={() => setPendingDeleteLinkId(link.id)}
										disabled={deleteRouteLink.isPending}
									>
										<Trash2 size={14} />
									</button>
								)}
							</li>
						))}
					</ul>
				)}

				{atLinkLimit && (
					<p className="text-xs text-white/70">
						You've reached the limit of 5 links per route.
					</p>
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
				<>
					<Button
						type="button"
						variant="primary"
						onClick={() => setShowLogSheet(true)}
					>
						Log this climb
					</Button>
					<LogClimbSheet
						isOpen={showLogSheet}
						onClose={() => setShowLogSheet(false)}
						route={route}
					/>
				</>
			)}
			<AddLinkModal
				isOpen={showAddLinkModal}
				isPending={addRouteLink.isPending}
				onSave={(url, title) => {
					addRouteLink.mutate(
						{ url, title, userId: user?.id ?? "" },
						{ onSuccess: () => setShowAddLinkModal(false) },
					);
				}}
				onCancel={() => setShowAddLinkModal(false)}
			/>

			<SunShadeSheet
				isOpen={sunSheetOpen}
				data={route.sun_data ?? null}
				isEditing={isAdmin ?? false}
				onSave={(data) => {
					updateRouteSunData.mutate(data, {
						onSuccess: () => setSunSheetOpen(false),
					});
				}}
				onClose={() => setSunSheetOpen(false)}
			/>

			<ConfirmDeleteDialog
				isOpen={pendingDeleteLinkId !== null}
				title="Delete link"
				message="Remove this link from the route?"
				onConfirm={() => {
					if (pendingDeleteLinkId) deleteRouteLink.mutate(pendingDeleteLinkId);
					setPendingDeleteLinkId(null);
				}}
				onCancel={() => setPendingDeleteLinkId(null)}
			/>
		</div>
	);
};

export default RouteDetailView;
