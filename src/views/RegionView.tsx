import { useNavigate, useParams } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { ConfirmDeleteDialog } from "@/components/molecules/ConfirmDeleteDialog";
import { useAuthStore } from "@/features/auth/auth.store";
import {
	useAdminDeleteSubRegion,
	useDownloadRegion,
	useStaleRegionIds,
	useSubmitSubRegion,
	useSubRegions,
} from "@/features/locations/locations.queries";
import type { SubRegion } from "@/features/locations/locations.schema";

// ── Inline name form ──────────────────────────────────────────────────────────

const InlineAddForm = ({
	placeholder,
	pending,
	onSubmit,
	onCancel,
}: {
	placeholder: string;
	pending: boolean;
	onSubmit: (name: string) => void;
	onCancel: () => void;
}) => {
	const [name, setName] = useState("");

	return (
		<div className="flex gap-2 mt-2">
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
				onClick={() => onSubmit(name.trim())}
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
	);
};

// ── Region view ───────────────────────────────────────────────────────────────

const RegionView = () => {
	const { regionId } = useParams({ from: "/regions/$regionId" });
	const navigate = useNavigate();
	const { data: subRegions = [] } = useSubRegions(regionId);
	const submitSubRegion = useSubmitSubRegion();
	const { data: staleIds = [] } = useStaleRegionIds();
	const { mutate: refresh, isPending: isRefreshing } = useDownloadRegion();
	const isStale = staleIds.includes(regionId);
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");
	const adminDeleteSubRegion = useAdminDeleteSubRegion();
	const [showSubRegionForm, setShowSubRegionForm] = useState(false);
	const [pendingDeleteSubRegion, setPendingDeleteSubRegion] =
		useState<SubRegion | null>(null);

	const handleAddSubRegion = async (name: string) => {
		await submitSubRegion.mutateAsync({ region_id: regionId, name });
		setShowSubRegionForm(false);
	};

	return (
		<div className="flex flex-col gap-3">
			{isStale && (
				<div className="flex items-center justify-between rounded-lg bg-amber-900/30 border border-amber-700/40 px-4 py-3 text-sm">
					<span className="text-amber-300">
						Newer data is available for this region.
					</span>
					<Button
						type="button"
						variant="secondary"
						size="small"
						onClick={() => refresh(regionId)}
						disabled={isRefreshing}
					>
						{isRefreshing ? "…" : "Refresh"}
					</Button>
				</div>
			)}

			{subRegions.length === 0 && !showSubRegionForm && (
				<p className="text-white text-sm">No areas in this region yet.</p>
			)}

			{subRegions.map((sr) => (
				<div
					key={sr.id}
					className="rounded-lg bg-surface-card p-4 flex items-center justify-between gap-2"
				>
					<button
						type="button"
						className="flex-1 text-left font-medium flex items-center justify-between gap-2 disabled:opacity-60"
						disabled={sr.status === "pending"}
						onClick={() =>
							navigate({
								to: "/sub-regions/$subRegionId",
								params: { subRegionId: sr.id },
							})
						}
					>
						<span>{sr.name}</span>
						{sr.status === "pending" && (
							<span className="text-xs text-amber-400">pending</span>
						)}
					</button>
					{isAdmin && sr.status === "verified" && sr.crag_count === 0 && (
						<button
							type="button"
							aria-label="Delete sub-area"
							className="shrink-0 text-text-on-light/60 hover:text-red-400"
							onClick={() => setPendingDeleteSubRegion(sr)}
						>
							<Trash2 size={15} />
						</button>
					)}
				</div>
			))}

			{showSubRegionForm ? (
				<InlineAddForm
					placeholder="Sub-area name"
					pending={submitSubRegion.isPending}
					onSubmit={handleAddSubRegion}
					onCancel={() => setShowSubRegionForm(false)}
				/>
			) : (
				<button
					type="button"
					onClick={() => setShowSubRegionForm(true)}
					className="text-sm text-text-light-on-dark-secondary hover:text-text-on-dark text-left"
				>
					+ Add sub-area
				</button>
			)}

			<ConfirmDeleteDialog
				isOpen={pendingDeleteSubRegion !== null}
				title="Delete sub-area"
				message={`Are you sure you want to delete "${pendingDeleteSubRegion?.name}"?`}
				onConfirm={() => {
					if (pendingDeleteSubRegion) {
						adminDeleteSubRegion.mutate({
							id: pendingDeleteSubRegion.id,
							regionId,
						});
					}
					setPendingDeleteSubRegion(null);
				}}
				onCancel={() => setPendingDeleteSubRegion(null)}
			/>
		</div>
	);
};

export default RegionView;
