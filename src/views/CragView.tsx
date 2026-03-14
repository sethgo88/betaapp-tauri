import { useNavigate, useParams } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import { CoordinatePicker } from "@/components/molecules/CoordinatePicker";
import { EditableDescription } from "@/components/molecules/EditableDescription";
import { useAuthStore } from "@/features/auth/auth.store";
import {
	useAdminUpdateCragCoords,
	useCrag,
	useSubmitWall,
	useUpdateLocationDescription,
	useWalls,
} from "@/features/locations/locations.queries";
import type { WallType } from "@/features/locations/locations.schema";

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

// ── Crag view ─────────────────────────────────────────────────────────────────

const CragView = () => {
	const { cragId } = useParams({ from: "/crags/$cragId" });
	const navigate = useNavigate();
	const { data: crag, isLoading } = useCrag(cragId);
	const { data: walls = [] } = useWalls(cragId);
	const submitWall = useSubmitWall();
	const updateDescription = useUpdateLocationDescription();
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");
	const updateCoords = useAdminUpdateCragCoords();
	const [showWallForm, setShowWallForm] = useState(false);
	const [showCoordEditor, setShowCoordEditor] = useState(false);

	const handleAddWall = async (name: string, wallType: WallType) => {
		await submitWall.mutateAsync({
			crag_id: cragId,
			name,
			wall_type: wallType,
		});
		setShowWallForm(false);
	};

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<button
				type="button"
				className="text-text-secondary text-sm text-left"
				onClick={() => {
					if (crag?.sub_region_id) {
						navigate({
							to: "/sub-regions/$subRegionId",
							params: { subRegionId: crag.sub_region_id },
						});
					}
				}}
			>
				← Back to area
			</button>

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
				<button
					key={wall.id}
					type="button"
					className="rounded-lg bg-surface-card p-4 text-left font-medium flex items-center justify-between"
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
					{wall.status === "pending" && (
						<span className="text-xs text-amber-400">pending</span>
					)}
				</button>
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
		</div>
	);
};

export default CragView;
