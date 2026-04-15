import type { DragEndEvent } from "@dnd-kit/core";
import {
	closestCenter,
	DndContext,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate, useParams } from "@tanstack/react-router";
import { GripVertical, MapPin, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { StarRating } from "@/components/atoms/StarRating";
import { TagPill } from "@/components/atoms/TagPill";
import { AdminImageGallery } from "@/components/molecules/AdminImageGallery";
import { ConfirmDeleteDialog } from "@/components/molecules/ConfirmDeleteDialog";
import {
	CoordinatePicker,
	type PickerMarker,
} from "@/components/molecules/CoordinatePicker";
import { EditableDescription } from "@/components/molecules/EditableDescription";
import { TagSelect } from "@/components/molecules/TagSelect";
import { TopoModal } from "@/components/molecules/TopoModal";
import { WallTopoBuilder } from "@/components/organisms/TopoBuilder";
import { useAuthStore } from "@/features/auth/auth.store";
import {
	useAdminUpdateWallCoords,
	useAdminUpdateWallType,
	useCrag,
	useUpdateLocationApproach,
	useUpdateLocationDescription,
	useWall,
	useWalls,
} from "@/features/locations/locations.queries";
import {
	useAddWallImage,
	useDeleteWallImage,
	useWallImages,
} from "@/features/route-images/route-images.queries";
import {
	useAdminDeleteRoute,
	useReorderRoutes,
	useRoutes,
} from "@/features/routes/routes.queries";
import type { Route } from "@/features/routes/routes.schema";
import { useSetWallTags, useWallTags } from "@/features/tags/tags.queries";
import { useWallTopo, useWallTopoLines } from "@/features/topos/topos.queries";

// ── Sortable route card (reorder mode) ────────────────────────────────────────

const SortableRouteCard = ({ route }: { route: Route }) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: route.id });

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.4 : 1,
		touchAction: "none",
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="rounded-lg bg-surface-card p-4 flex items-center gap-3"
		>
			<button
				type="button"
				className="shrink-0 text-text-tertiary touch-none cursor-grab active:cursor-grabbing"
				aria-label="Drag to reorder"
				{...attributes}
				{...listeners}
			>
				<GripVertical size={18} />
			</button>
			<div className="flex-1 flex items-center justify-between gap-2">
				<span className="font-medium">{route.name}</span>
				<div className="flex items-center gap-2">
					{route.avg_rating != null && (
						<span className="flex items-center gap-1">
							<StarRating value={Math.round(route.avg_rating)} readOnly size={14} />
							<span className="text-xs text-text-tertiary">
								{route.avg_rating.toFixed(1)} · {route.rating_count ?? 0}
							</span>
						</span>
					)}
					<span className="text-xs text-text-secondary">{route.grade}</span>
					<span className="text-xs text-text-tertiary">{route.route_type}</span>
				</div>
			</div>
		</div>
	);
};

const ViewOnMap = ({ lat, lng }: { lat: number; lng: number }) => {
	const navigate = useNavigate();
	return (
		<div className="flex items-center gap-3">
			<p className="text-xs text-text-secondary">
				{lat.toFixed(5)}, {lng.toFixed(5)}
			</p>
			<button
				type="button"
				onClick={() => navigate({ to: "/map", search: { lat, lng, zoom: 15 } })}
				className="flex items-center gap-1 text-xs text-accent-primary font-semibold"
			>
				<MapPin size={12} />
				View on map
			</button>
		</div>
	);
};

const WallView = () => {
	const { wallId } = useParams({ from: "/walls/$wallId" });
	const navigate = useNavigate();
	const { data: wall, isLoading } = useWall(wallId);
	const { data: crag } = useCrag(wall?.crag_id ?? null);
	const { data: siblingWalls = [] } = useWalls(wall?.crag_id ?? null);
	const { data: routes = [] } = useRoutes(wallId);
	const { data: wallImages = [] } = useWallImages(wallId);
	const updateDescription = useUpdateLocationDescription();
	const updateApproach = useUpdateLocationApproach();
	const updateCoords = useAdminUpdateWallCoords();
	const updateWallType = useAdminUpdateWallType();
	const addWallImage = useAddWallImage(wallId);
	const deleteWallImage = useDeleteWallImage(wallId);
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");
	const [showCoordEditor, setShowCoordEditor] = useState(false);
	const [showTopoModal, setShowTopoModal] = useState(false);
	const [showTopoEdit, setShowTopoEdit] = useState(false);
	const [isReordering, setIsReordering] = useState(false);
	const [reorderList, setReorderList] = useState<Route[]>([]);
	const [pendingDeleteRoute, setPendingDeleteRoute] = useState<Route | null>(
		null,
	);
	const reorderRoutesMutation = useReorderRoutes(wallId);
	const adminDeleteRoute = useAdminDeleteRoute();
	const { data: wallTags = [] } = useWallTags(wallId);
	const setWallTags = useSetWallTags(wallId);

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 250, tolerance: 5 },
		}),
	);

	function handleStartReorder() {
		setReorderList([...routes]);
		setIsReordering(true);
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			setReorderList((prev) => {
				const oldIndex = prev.findIndex((r) => r.id === active.id);
				const newIndex = prev.findIndex((r) => r.id === over.id);
				return arrayMove(prev, oldIndex, newIndex);
			});
		}
	}

	async function handleSaveOrder() {
		await reorderRoutesMutation.mutateAsync(reorderList.map((r) => r.id));
		setIsReordering(false);
	}

	const { data: wallTopo = null } = useWallTopo(wallId);
	const { data: wallTopoLines = [] } = useWallTopoLines(wallTopo?.id ?? null);

	const siblingMarkers = useMemo<PickerMarker[]>(() => {
		const result: PickerMarker[] = [];
		for (const w of siblingWalls) {
			if (w.id !== wallId && w.lat != null && w.lng != null) {
				result.push({ lat: w.lat, lng: w.lng, label: w.name });
			}
		}
		return result;
	}, [siblingWalls, wallId]);

	const cragCoords =
		crag?.lat != null && crag?.lng != null
			? { lat: crag.lat, lng: crag.lng }
			: null;

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
			<h1 className="text-xl font-display font-bold">{wall.name}</h1>

			{isAdmin ? (
				<select
					value={wall.wall_type ?? "wall"}
					onChange={(e) =>
						updateWallType.mutate({ id: wallId, wallType: e.target.value })
					}
					className="self-start text-xs bg-surface-page text-text-secondary rounded-[var(--radius-sm)] px-2 py-1 border border-border-default"
				>
					<option value="wall">Wall</option>
					<option value="boulder">Boulder</option>
				</select>
			) : (
				<span className="text-xs text-text-secondary capitalize">
					{wall.wall_type ?? "wall"}
				</span>
			)}

			{isAdmin ? (
				<TagSelect
					value={wallTags}
					onChange={(tags) => setWallTags.mutate(tags.map((t) => t.id))}
				/>
			) : (
				wallTags.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{wallTags.map((tag) => (
							<TagPill key={tag.id} name={tag.name} />
						))}
					</div>
				)
			)}

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

			<div className="flex flex-col gap-1">
				<p className="text-xs text-text-tertiary uppercase tracking-wide">
					Approach
				</p>
				<EditableDescription
					description={wall.approach}
					isAdmin={isAdmin}
					placeholder="Describe how to get here…"
					emptyText="No approach info"
					onSave={async (approach) => {
						await updateApproach.mutateAsync({
							table: "walls",
							id: wallId,
							approach,
						});
					}}
				/>
			</div>

			<AdminImageGallery
				images={wallImages}
				isAdmin={isAdmin ?? false}
				onAdd={(file) => addWallImage.mutate(file)}
				onDelete={(id, imageUrl) => deleteWallImage.mutate({ id, imageUrl })}
				isAdding={addWallImage.isPending}
			/>

			{/* Topo section */}
			{wallTopo && (
				<div className="flex flex-col gap-1">
					<p className="text-xs text-text-tertiary">Topo</p>
					<button
						type="button"
						onClick={() => setShowTopoModal(true)}
						className="relative max-h-36 w-full rounded-[var(--radius-md)] overflow-hidden"
						aria-label="View topo"
					>
						<div className="relative -translate-y-1/3">
							<img
								src={wallTopo.image_url}
								alt="Wall topo"
								className="w-full"
								draggable={false}
							/>
							{wallTopoLines.length > 0 && (
								<svg
									className="absolute inset-0 w-full h-full"
									viewBox="0 0 100 100"
									preserveAspectRatio="none"
									aria-hidden="true"
									style={{ pointerEvents: "none" }}
								>
									{wallTopoLines.map(
										(line) =>
											line.points.length >= 2 && (
												<polyline
													key={line.id}
													points={line.points
														.map((p) => `${p.x_pct * 100},${p.y_pct * 100}`)
														.join(" ")}
													stroke={line.color}
													strokeWidth="2"
													fill="none"
													strokeLinecap="round"
													strokeLinejoin="round"
													vectorEffect="non-scaling-stroke"
												/>
											),
									)}
								</svg>
							)}
						</div>
					</button>
				</div>
			)}

			{isAdmin && (
				<button
					type="button"
					onClick={() => setShowTopoEdit(true)}
					className="text-sm text-accent-primary text-left"
				>
					{wallTopo ? "Edit topo" : "+ Add topo"}
				</button>
			)}
			{showTopoEdit && (
				<WallTopoBuilder
					wallId={wallId}
					routes={routes.filter((r) => r.status === "verified")}
					topo={wallTopo}
					lines={wallTopoLines}
					galleryImages={wallImages}
					onClose={() => setShowTopoEdit(false)}
				/>
			)}

			{showTopoModal && wallTopo && (
				<TopoModal
					mode="wall"
					topo={wallTopo}
					lines={wallTopoLines}
					routes={routes
						.filter((r) => r.status === "verified")
						.map((r) => ({
							id: r.id,
							name: r.name,
							grade: r.grade,
							route_type: r.route_type,
						}))}
					onClose={() => setShowTopoModal(false)}
					onNavigateToRoute={(routeId) => {
						setShowTopoModal(false);
						navigate({ to: "/routes/$routeId", params: { routeId } });
					}}
				/>
			)}

			{wall.lat != null && wall.lng != null && (
				<ViewOnMap lat={wall.lat} lng={wall.lng} />
			)}

			{isAdmin && (
				<div className="flex flex-col gap-2">
					<button
						type="button"
						onClick={() => setShowCoordEditor(true)}
						className="text-sm text-text-secondary hover:text-text-primary text-left"
					>
						{wall.lat != null ? "Edit coordinates" : "+ Add coordinates"}
					</button>
					{showCoordEditor && (
						<CoordinatePicker
							value={
								wall.lat != null && wall.lng != null
									? { lat: wall.lat, lng: wall.lng }
									: null
							}
							defaultCenter={cragCoords}
							defaultZoom={cragCoords ? 15 : 12}
							markers={siblingMarkers}
							onChange={async (coords) => {
								await updateCoords.mutateAsync({
									id: wallId,
									lat: coords.lat,
									lng: coords.lng,
									cragId: wall.crag_id,
								});
							}}
							onClose={() => setShowCoordEditor(false)}
						/>
					)}
				</div>
			)}

			{routes.length === 0 && (
				<p className="text-text-secondary text-sm">
					No routes on this wall yet.
				</p>
			)}

			{isAdmin &&
				routes.length > 1 &&
				(isReordering ? (
					<button
						type="button"
						onClick={handleSaveOrder}
						disabled={reorderRoutesMutation.isPending}
						className="text-sm text-accent-primary font-semibold text-left"
					>
						{reorderRoutesMutation.isPending ? "Saving…" : "Done"}
					</button>
				) : (
					<button
						type="button"
						onClick={handleStartReorder}
						className="text-sm text-accent-primary text-left"
					>
						Edit order
					</button>
				))}

			{isReordering ? (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={reorderList.map((r) => r.id)}
						strategy={verticalListSortingStrategy}
					>
						{reorderList.map((route) => (
							<SortableRouteCard key={route.id} route={route} />
						))}
					</SortableContext>
				</DndContext>
			) : (
				routes.map((route) => (
					<div
						key={route.id}
						className="rounded-lg bg-surface-card p-4 flex items-start gap-2"
					>
						<button
							type="button"
							disabled={route.status === "pending"}
							className="flex-1 text-left flex items-start justify-between gap-2 disabled:opacity-60"
							onClick={() =>
								navigate({
									to: "/routes/$routeId",
									params: { routeId: route.id },
								})
							}
						>
							<div className="flex flex-col gap-0.5">
								<span className="font-medium">{route.name}</span>
								<div className="flex items-center gap-1.5">
									<span className="text-xs text-text-secondary">{route.grade}</span>
									<span className="text-xs text-text-tertiary">{route.route_type}</span>
									{route.status === "pending" && (
										<span className="text-xs text-accent-secondary">pending</span>
									)}
								</div>
							</div>
							{route.avg_rating != null && (
								<span className="flex items-center gap-1 shrink-0">
									<StarRating
										value={Math.round(route.avg_rating)}
										readOnly
										size={14}
									/>
									<span className="text-xs text-text-tertiary">
										{route.avg_rating.toFixed(1)} · {route.rating_count ?? 0}
									</span>
								</span>
							)}
						</button>
						{isAdmin && route.status === "verified" && (
							<button
								type="button"
								aria-label="Delete route"
								className="shrink-0 text-text-tertiary hover:text-red-400"
								onClick={() => setPendingDeleteRoute(route)}
							>
								<Trash2 size={15} />
							</button>
						)}
					</div>
				))
			)}

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

			<ConfirmDeleteDialog
				isOpen={pendingDeleteRoute !== null}
				title="Delete route"
				message={`Delete "${pendingDeleteRoute?.name}"? Any logged climbs linked to this route will be unlinked.`}
				onConfirm={() => {
					if (pendingDeleteRoute) {
						adminDeleteRoute.mutate({ id: pendingDeleteRoute.id, wallId });
					}
					setPendingDeleteRoute(null);
				}}
				onCancel={() => setPendingDeleteRoute(null)}
			/>
		</div>
	);
};

export default WallView;
