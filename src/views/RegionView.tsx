import { useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import {
	useSubmitSubRegion,
	useSubRegions,
} from "@/features/locations/locations.queries";

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
				className="flex-1 text-sm bg-stone-700 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-500 outline-none"
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
				className="text-sm px-3 py-2 rounded-lg bg-stone-600 hover:bg-stone-500"
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
	const [showSubRegionForm, setShowSubRegionForm] = useState(false);

	const handleAddSubRegion = async (name: string) => {
		await submitSubRegion.mutateAsync({ region_id: regionId, name });
		setShowSubRegionForm(false);
	};

	return (
		<div className="flex flex-col gap-3">
			<button
				type="button"
				className="text-stone-400 text-sm text-left"
				onClick={() => navigate({ to: "/routes" })}
			>
				← Back to routes
			</button>

			{subRegions.length === 0 && !showSubRegionForm && (
				<p className="text-stone-400 text-sm">No areas in this region yet.</p>
			)}

			{subRegions.map((sr) => (
				<button
					key={sr.id}
					type="button"
					className="rounded-lg bg-stone-800 p-4 text-left font-medium flex items-center justify-between"
					onClick={() =>
						sr.status === "pending"
							? undefined
							: navigate({
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
					className="text-sm text-stone-400 hover:text-stone-200 text-left"
				>
					+ Add sub-area
				</button>
			)}
		</div>
	);
};

export default RegionView;
