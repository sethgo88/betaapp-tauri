import { useNavigate, useParams } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { ConfirmDeleteDialog } from "@/components/molecules/ConfirmDeleteDialog";
import { CoordinatePicker } from "@/components/molecules/CoordinatePicker";
import { EditableDescription } from "@/components/molecules/EditableDescription";
import {
	LocationDrillDown,
	type LocationSelection,
} from "@/components/molecules/LocationDrillDown";
import { useAuthStore } from "@/features/auth/auth.store";
import {
	useAdminDeleteWall,
	useAdminMoveWall,
	useAdminRenameLocation,
	useAdminUpdateCragCoords,
	useCrag,
	useSubmitWall,
	useUpdateLocationApproach,
	useUpdateLocationDescription,
	useWalls,
} from "@/features/locations/locations.queries";
import type { WallType } from "@/features/locations/locations.schema";
import { useUiStore } from "@/stores/ui.store";

// ── Inline name form ──────────────────────────────────────────────────────────

const InlineAddForm = ({
	placeholder,
	pending,
	onSubmit,
	onCancel,
}: {
	placeholder: string;
	pending: boolean;
	onSubmit: (name: string, wallType: WallType) => void;
	onCancel: () => void;
}) => {
	const [name, setName] = useState("");
	const [wallType, setWallType] = useState<WallType>("wall");

	return (
		<div className="flex flex-col gap-2 mt-2">
			<div className="flex rounded-[var(--radius-md)] border border-border-default overflow-hidden self-start">
				<button
					type="button"
					className={`px-3 py-1.5 text-sm font-semibold ${
						wallType === "wall"
							? "bg-accent-primary text-white"
							: "bg-surface-card text-text-secondary"
					}`}
					onClick={() => setWallType("wall")}
				>
					Wall
				</button>
				<button
					type="button"
					className={`px-3 py-1.5 text-sm font-semibold ${
						wallType === "boulder"
							? "bg-accent-primary text-white"
							: "bg-surface-card text-text-secondary"
					}`}
					onClick={() => setWallType("boulder")}
				>
					Boulder
				</button>
			</div>
			<div className="flex gap-2">
				<input
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder={placeholder}
					className="flex-1 text-sm bg-surface-page rounded-lg px-3 py-2 text-text-primary placeholder-text-tertiary outline-none"
					// biome-ignore lint/a11y/noAutofocus: intentional — form appears on user tap
					autoFocus
				/>
				<button
					type="button"
					disabled={!name.trim() || pending}
					onClick={() => onSubmit(name.trim(), wallType)}
					className="text-sm px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40"
				>
					{pending ? "…" : "Add"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="text-sm px-3 py-2 rounded-lg bg-surface-active hover:bg-surface-hover"
				>
					Cancel
				</button>
			</div>
		</div>
	);
};

// ── View on map link ────────────────────────────────────────────────────────

const ViewOnMap = ({ lat, lng }: { lat: number; lng: number }) => {
	const navigate = useNavigate();
	return (
		<div className="flex items-center gap-3">
			<p className="text-xs text-text-secondary">
				{lat.toFixed(5)}, {lng.toFixed(5)}
			</p>
			<button
				type="button"
				onClick={() => navigate({ to: "/map", search: { lat, lng, zoom: 14 } })}
				className="flex items-center gap-1 text-xs text-accent-primary font-semibold"
			>
				<MapPin size={12} />
				View on map
			</button>
		</div>
	);
};

// ── Move wall panel ───────────────────────────────────────────────────────────

const MoveWallPanel = ({
	wallId,
	currentCragId,
	onClose,
}: {
	wallId: string;
	currentCragId: string;
	onClose: () => void;
}) => {
	const addToast = useUiStore((s) => s.addToast);
	const { mutateAsync: moveWall, isPending } = useAdminMoveWall();
	const [selection, setSelection] = useState<LocationSelection>({
		countryId: null,
		regionId: null,
		subRegionId: null,
		cragId: null,
		wallId: null,
		wall: null,
	});

	const handleChange = useCallback((sel: LocationSelection) => {
		setSelection(sel);
	}, []);

	const canMove = !!selection.cragId && selection.cragId !== currentCragId;

	const handleMove = async () => {
		if (!selection.cragId) return;
		try {
			await moveWall({
				wallId,
				newCragId: selection.cragId,
				oldCragId: currentCragId,
			});
			addToast({ message: "Wall moved", type: "success" });
			onClose();
		} catch {
			addToast({ message: "Failed to move wall", type: "error" });
		}
	};

	return (
		<div className="rounded-lg bg-surface-card border border-card-border p-4 flex flex-col gap-3">
			<p className="text-sm font-medium text-text-primary">Move to crag</p>
			<LocationDrillDown onChange={handleChange} stopAt="crag" />
			<div className="flex gap-2">
				<Button
					type="button"
					variant="primary"
					size="small"
					onClick={handleMove}
					disabled={!canMove || isPending}
				>
					{isPending ? "Moving…" : "Move here"}
				</Button>
				<Button
					type="button"
					variant="secondary"
					size="small"
					onClick={onClose}
					disabled={isPending}
				>
					Cancel
				</Button>
			</div>
		</div>
	);
};

// ── Crag view ─────────────────────────────────────────────────────────────────

const CragView = () => {
	const { cragId } = useParams({ from: "/crags/$cragId" });
	const navigate = useNavigate();
	const { data: crag, isLoading } = useCrag(cragId);
	const { data: walls = [] } = useWalls(cragId);
	const submitWall = useSubmitWall();
	const updateDescription = useUpdateLocationDescription();
	const updateApproach = useUpdateLocationApproach();
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");
	const addToast = useUiStore((s) => s.addToast);
	const updateCoords = useAdminUpdateCragCoords();
	const renameWall = useAdminRenameLocation();
	const deleteWall = useAdminDeleteWall();
	const [showWallForm, setShowWallForm] = useState(false);
	const [showCoordEditor, setShowCoordEditor] = useState(false);
	const [movingWallId, setMovingWallId] = useState<string | null>(null);
	const [renamingWallId, setRenamingWallId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [confirmDeleteWallId, setConfirmDeleteWallId] = useState<string | null>(
		null,
	);

	const handleAddWall = async (name: string, wallType: WallType) => {
		await submitWall.mutateAsync({
			crag_id: cragId,
			name,
			wall_type: wallType,
		});
		setShowWallForm(false);
	};

	const pendingDeleteWall = walls.find((w) => w.id === confirmDeleteWallId);

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{crag && (
				<>
					<h1 className="text-xl font-display font-bold">{crag.name}</h1>
					<EditableDescription
						description={crag.description}
						isAdmin={isAdmin}
						onSave={async (description) => {
							await updateDescription.mutateAsync({
								table: "crags",
								id: cragId,
								description,
							});
						}}
					/>

					<div className="flex flex-col gap-1">
						<p className="text-xs text-text-tertiary uppercase tracking-wide">
							Approach
						</p>
						<EditableDescription
							description={crag.approach}
							isAdmin={isAdmin}
							placeholder="Describe how to get here…"
							emptyText="No approach info"
							onSave={async (approach) => {
								await updateApproach.mutateAsync({
									table: "crags",
									id: cragId,
									approach,
								});
							}}
						/>
					</div>

					{crag.lat != null && crag.lng != null && (
						<ViewOnMap lat={crag.lat} lng={crag.lng} />
					)}

					{isAdmin && (
						<div className="flex flex-col gap-2">
							<button
								type="button"
								onClick={() => setShowCoordEditor(true)}
								className="text-sm text-text-secondary hover:text-text-primary text-left"
							>
								{crag.lat != null ? "Edit coordinates" : "+ Add coordinates"}
							</button>
							{showCoordEditor && (
								<CoordinatePicker
									value={
										crag.lat != null && crag.lng != null
											? { lat: crag.lat, lng: crag.lng }
											: null
									}
									onChange={async (coords) => {
										await updateCoords.mutateAsync({
											id: cragId,
											lat: coords.lat,
											lng: coords.lng,
										});
									}}
									onClose={() => setShowCoordEditor(false)}
								/>
							)}
						</div>
					)}
				</>
			)}

			{walls.length === 0 && !showWallForm && (
				<p className="text-text-secondary text-sm">
					No walls in this crag yet.
				</p>
			)}

			{walls.map((wall) => (
				<div key={wall.id} className="flex flex-col gap-1">
					{renamingWallId === wall.id ? (
						<div className="rounded-lg bg-surface-card p-3 flex gap-2 items-center">
							<input
								type="text"
								value={renameValue}
								onChange={(e) => setRenameValue(e.target.value)}
								className="flex-1 text-sm bg-surface-page rounded-lg px-3 py-2 text-text-primary outline-none"
								// biome-ignore lint/a11y/noAutofocus: intentional — form appears on user tap
								autoFocus
							/>
							<button
								type="button"
								disabled={!renameValue.trim() || renameWall.isPending}
								onClick={async () => {
									try {
										await renameWall.mutateAsync({
											table: "walls",
											id: wall.id,
											name: renameValue.trim(),
											parentId: cragId,
										});
										setRenamingWallId(null);
									} catch {
										addToast({
											message: "Failed to rename wall",
											type: "error",
										});
									}
								}}
								className="text-xs px-3 py-1.5 rounded-lg bg-accent-primary disabled:opacity-40"
							>
								Save
							</button>
							<button
								type="button"
								onClick={() => setRenamingWallId(null)}
								className="text-xs px-3 py-1.5 rounded-lg bg-surface-active"
							>
								Cancel
							</button>
						</div>
					) : (
						<div className="rounded-lg bg-surface-card p-4 text-left font-medium flex items-center justify-between">
							<button
								type="button"
								className="flex-1 text-left"
								onClick={() =>
									wall.status === "pending"
										? undefined
										: navigate({
												to: "/walls/$wallId",
												params: { wallId: wall.id },
											})
								}
							>
								<div className="flex items-center gap-2">
									<span>{wall.name}</span>
									{wall.wall_type === "boulder" && (
										<span className="text-xs text-text-tertiary">Boulder</span>
									)}
								</div>
							</button>
							<div className="flex items-center gap-2">
								{wall.status === "pending" && (
									<span className="text-xs text-amber-400">pending</span>
								)}
								{isAdmin && (
									<>
										<button
											type="button"
											className="text-xs text-text-secondary hover:text-text-primary"
											onClick={() => {
												setRenamingWallId(wall.id);
												setRenameValue(wall.name);
												setMovingWallId(null);
												setConfirmDeleteWallId(null);
											}}
										>
											Rename
										</button>
										<button
											type="button"
											className="text-xs text-text-secondary hover:text-text-primary"
											onClick={() =>
												setMovingWallId(
													movingWallId === wall.id ? null : wall.id,
												)
											}
										>
											{movingWallId === wall.id ? "Cancel" : "Move"}
										</button>
										<button
											type="button"
											className="text-xs text-red-400 hover:text-red-300"
											onClick={() => {
												setConfirmDeleteWallId(wall.id);
												setMovingWallId(null);
												setRenamingWallId(null);
											}}
										>
											Delete
										</button>
									</>
								)}
							</div>
						</div>
					)}
					{movingWallId === wall.id && (
						<MoveWallPanel
							wallId={wall.id}
							currentCragId={cragId}
							onClose={() => setMovingWallId(null)}
						/>
					)}
				</div>
			))}

			{showWallForm ? (
				<InlineAddForm
					placeholder="Wall name"
					pending={submitWall.isPending}
					onSubmit={handleAddWall}
					onCancel={() => setShowWallForm(false)}
				/>
			) : (
				<button
					type="button"
					onClick={() => setShowWallForm(true)}
					className="text-sm text-text-secondary hover:text-text-primary text-left"
				>
					+ Add wall
				</button>
			)}

			<ConfirmDeleteDialog
				isOpen={confirmDeleteWallId !== null}
				title="Delete wall"
				message={`Delete "${pendingDeleteWall?.name ?? ""}"? This will also delete all routes and topos on this wall.`}
				onConfirm={async () => {
					if (!pendingDeleteWall) return;
					try {
						await deleteWall.mutateAsync({ id: pendingDeleteWall.id, cragId });
						setConfirmDeleteWallId(null);
						addToast({ message: "Wall deleted", type: "success" });
					} catch (e) {
						addToast({
							message: e instanceof Error ? e.message : "Failed to delete",
							type: "error",
						});
						setConfirmDeleteWallId(null);
					}
				}}
				onCancel={() => setConfirmDeleteWallId(null)}
			/>
		</div>
	);
};

export default CragView;
