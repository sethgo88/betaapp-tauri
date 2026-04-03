import { useNavigate, useParams } from "@tanstack/react-router";
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
	useAdminDeleteCrag,
	useAdminMoveCrag,
	useAdminRenameLocation,
	useCrags,
	useSubmitCrag,
	useSubRegion,
	useUpdateLocationDescription,
} from "@/features/locations/locations.queries";
import { useUiStore } from "@/stores/ui.store";

// ── Move crag panel ───────────────────────────────────────────────────────────

const MoveCragPanel = ({
	cragId,
	currentSubRegionId,
	onClose,
}: {
	cragId: string;
	currentSubRegionId: string;
	onClose: () => void;
}) => {
	const addToast = useUiStore((s) => s.addToast);
	const { mutateAsync: moveCrag, isPending } = useAdminMoveCrag();
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

	const canMove =
		!!selection.subRegionId && selection.subRegionId !== currentSubRegionId;

	const handleMove = async () => {
		if (!selection.subRegionId) return;
		try {
			await moveCrag({
				cragId,
				newSubRegionId: selection.subRegionId,
				oldSubRegionId: currentSubRegionId,
			});
			addToast({ message: "Crag moved", type: "success" });
			onClose();
		} catch {
			addToast({ message: "Failed to move crag", type: "error" });
		}
	};

	return (
		<div className="rounded-lg bg-surface-card border border-card-border p-4 flex flex-col gap-3">
			<p className="text-sm font-medium text-text-primary">Move to sub-area</p>
			<LocationDrillDown onChange={handleChange} stopAt="sub_region" />
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

// ── Sub-region view ───────────────────────────────────────────────────────────

const SubRegionView = () => {
	const { subRegionId } = useParams({ from: "/sub-regions/$subRegionId" });
	const navigate = useNavigate();
	const { data: subRegion, isLoading } = useSubRegion(subRegionId);
	const { data: crags = [] } = useCrags(subRegionId);
	const updateDescription = useUpdateLocationDescription();
	const submitCrag = useSubmitCrag();
	const renameCrag = useAdminRenameLocation();
	const deleteCrag = useAdminDeleteCrag();
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");
	const addToast = useUiStore((s) => s.addToast);
	const [showCragForm, setShowCragForm] = useState(false);
	const [movingCragId, setMovingCragId] = useState<string | null>(null);
	const [renamingCragId, setRenamingCragId] = useState<string | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [confirmDeleteCragId, setConfirmDeleteCragId] = useState<string | null>(
		null,
	);
	const [cragName, setCragName] = useState("");
	const [cragCoords, setCragCoords] = useState<{
		lat: number;
		lng: number;
	} | null>(null);
	const [showCoordPicker, setShowCoordPicker] = useState(false);

	const handleAddCrag = async () => {
		await submitCrag.mutateAsync({
			sub_region_id: subRegionId,
			name: cragName.trim(),
			lat: cragCoords?.lat,
			lng: cragCoords?.lng,
		});
		setCragName("");
		setCragCoords(null);
		setShowCragForm(false);
	};

	const pendingDeleteCrag = crags.find((c) => c.id === confirmDeleteCragId);

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	if (!subRegion) {
		return <p className="text-text-secondary text-center pt-12">Not found</p>;
	}

	return (
		<div className="flex flex-col gap-3">
			<h1 className="text-xl font-display font-bold">{subRegion.name}</h1>

			<EditableDescription
				description={subRegion.description}
				isAdmin={isAdmin}
				onSave={async (description) => {
					await updateDescription.mutateAsync({
						table: "sub_regions",
						id: subRegionId,
						description,
					});
				}}
			/>

			{crags.length === 0 && (
				<p className="text-text-secondary text-sm">
					No crags in this area yet.
				</p>
			)}

			{crags.map((crag) => (
				<div key={crag.id} className="flex flex-col gap-1">
					{renamingCragId === crag.id ? (
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
								disabled={!renameValue.trim() || renameCrag.isPending}
								onClick={async () => {
									try {
										await renameCrag.mutateAsync({
											table: "crags",
											id: crag.id,
											name: renameValue.trim(),
											parentId: subRegionId,
										});
										setRenamingCragId(null);
									} catch {
										addToast({
											message: "Failed to rename crag",
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
								onClick={() => setRenamingCragId(null)}
								className="text-xs px-3 py-1.5 rounded-lg bg-surface-active"
							>
								Cancel
							</button>
						</div>
					) : (
						<div className="rounded-lg bg-surface-card p-4 text-left flex items-center justify-between">
							<button
								type="button"
								className="flex-1 text-left"
								onClick={() =>
									crag.status === "pending"
										? undefined
										: navigate({
												to: "/crags/$cragId",
												params: { cragId: crag.id },
											})
								}
							>
								<span className="font-medium">{crag.name}</span>
							</button>
							<div className="flex items-center gap-2">
								{crag.status === "pending" && (
									<span className="text-xs text-amber-400">pending</span>
								)}
								{isAdmin && (
									<>
										<button
											type="button"
											className="text-xs text-text-secondary hover:text-text-primary"
											onClick={() => {
												setRenamingCragId(crag.id);
												setRenameValue(crag.name);
												setMovingCragId(null);
												setConfirmDeleteCragId(null);
											}}
										>
											Rename
										</button>
										<button
											type="button"
											className="text-xs text-text-secondary hover:text-text-primary"
											onClick={() =>
												setMovingCragId(
													movingCragId === crag.id ? null : crag.id,
												)
											}
										>
											{movingCragId === crag.id ? "Cancel" : "Move"}
										</button>
										{crag.wall_count === 0 && (
											<button
												type="button"
												className="text-xs text-red-400 hover:text-red-300"
												onClick={() => {
													setConfirmDeleteCragId(crag.id);
													setMovingCragId(null);
													setRenamingCragId(null);
												}}
											>
												Delete
											</button>
										)}
									</>
								)}
							</div>
						</div>
					)}
					{movingCragId === crag.id && (
						<MoveCragPanel
							cragId={crag.id}
							currentSubRegionId={subRegionId}
							onClose={() => setMovingCragId(null)}
						/>
					)}
				</div>
			))}

			{showCragForm ? (
				<div className="flex flex-col gap-3 mt-2">
					<div className="flex gap-2">
						<input
							type="text"
							value={cragName}
							onChange={(e) => setCragName(e.target.value)}
							placeholder="Crag name"
							className="flex-1 text-sm bg-surface-page rounded-[var(--radius-lg)] px-3 py-2 text-text-primary placeholder-text-tertiary outline-none"
							// biome-ignore lint/a11y/noAutofocus: intentional — form appears on user tap
							autoFocus
						/>
					</div>
					{cragCoords ? (
						<p className="text-xs text-text-secondary">
							Location: {cragCoords.lat.toFixed(5)}, {cragCoords.lng.toFixed(5)}
						</p>
					) : null}
					<button
						type="button"
						onClick={() => setShowCoordPicker(true)}
						className="text-sm text-accent-primary text-left"
					>
						{cragCoords ? "Change location" : "+ Add location"}
					</button>
					{showCoordPicker && (
						<CoordinatePicker
							value={cragCoords}
							onChange={setCragCoords}
							onClose={() => setShowCoordPicker(false)}
						/>
					)}
					<div className="flex gap-2">
						<button
							type="button"
							disabled={!cragName.trim() || submitCrag.isPending}
							onClick={handleAddCrag}
							className="text-sm px-3 py-2 rounded-[var(--radius-md)] bg-accent-secondary hover:bg-accent-secondary/90 disabled:opacity-40 font-semibold"
						>
							{submitCrag.isPending ? "..." : "Add"}
						</button>
						<button
							type="button"
							onClick={() => {
								setShowCragForm(false);
								setCragName("");
								setCragCoords(null);
								setShowCoordPicker(false);
							}}
							className="text-sm px-3 py-2 rounded-[var(--radius-md)] bg-surface-active hover:bg-surface-hover"
						>
							Cancel
						</button>
					</div>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setShowCragForm(true)}
					className="text-sm text-text-secondary hover:text-text-primary text-left"
				>
					+ Add crag
				</button>
			)}

			<ConfirmDeleteDialog
				isOpen={confirmDeleteCragId !== null}
				title="Delete crag"
				message={`Are you sure you want to delete "${pendingDeleteCrag?.name ?? ""}"?`}
				onConfirm={async () => {
					if (!pendingDeleteCrag) return;
					try {
						await deleteCrag.mutateAsync({
							id: pendingDeleteCrag.id,
							subRegionId,
						});
						setConfirmDeleteCragId(null);
						addToast({ message: "Crag deleted", type: "success" });
					} catch (e) {
						addToast({
							message: e instanceof Error ? e.message : "Failed to delete",
							type: "error",
						});
						setConfirmDeleteCragId(null);
					}
				}}
				onCancel={() => setConfirmDeleteCragId(null)}
			/>
		</div>
	);
};

export default SubRegionView;
