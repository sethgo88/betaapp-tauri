import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import { CoordinatePicker } from "@/components/molecules/CoordinatePicker";
import { EditableDescription } from "@/components/molecules/EditableDescription";
import { useAuthStore } from "@/features/auth/auth.store";
import {
	useCrags,
	useSubmitCrag,
	useSubRegion,
	useUpdateLocationDescription,
} from "@/features/locations/locations.queries";

const SubRegionView = () => {
	const { subRegionId } = useParams({ from: "/sub-regions/$subRegionId" });
	const navigate = useNavigate();
	const { data: subRegion, isLoading } = useSubRegion(subRegionId);
	const { data: crags = [] } = useCrags(subRegionId);
	const updateDescription = useUpdateLocationDescription();
	const submitCrag = useSubmitCrag();
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");
	const [showCragForm, setShowCragForm] = useState(false);
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
			<button
				type="button"
				className="text-text-secondary text-sm text-left"
				onClick={() =>
					navigate({
						to: "/regions/$regionId",
						params: { regionId: subRegion.region_id },
					})
				}
			>
				← Back to region
			</button>

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
				<button
					key={crag.id}
					type="button"
					className="rounded-lg bg-surface-card p-4 text-left flex items-center justify-between"
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
					<div className="flex items-center gap-2">
						{crag.status === "pending" && (
							<span className="text-xs text-amber-400">pending</span>
						)}
					</div>
				</button>
			))}

			{showCragForm ? (
				<div className="flex flex-col gap-3 mt-2">
					<div className="flex gap-2">
						<input
							type="text"
							value={cragName}
							onChange={(e) => setCragName(e.target.value)}
							placeholder="Crag name"
							className="flex-1 text-sm bg-surface-page rounded-[--radius-lg] px-3 py-2 text-text-primary placeholder-text-tertiary outline-none"
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
							className="text-sm px-3 py-2 rounded-[--radius-md] bg-accent-secondary hover:bg-accent-secondary/90 disabled:opacity-40 font-semibold"
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
							className="text-sm px-3 py-2 rounded-[--radius-md] bg-surface-active hover:bg-surface-hover"
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
		</div>
	);
};

export default SubRegionView;
