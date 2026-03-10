import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	useCrags,
	useSubmitCrag,
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

// ── Crag list with "Add crag" form ────────────────────────────────────────────

const CragList = ({ subRegionId }: { subRegionId: string }) => {
	const navigate = useNavigate();
	const { data: crags = [] } = useCrags(subRegionId);
	const submitCrag = useSubmitCrag();
	const [showForm, setShowForm] = useState(false);

	const handleAddCrag = async (name: string) => {
		await submitCrag.mutateAsync({ sub_region_id: subRegionId, name });
		setShowForm(false);
	};

	return (
		<div className="mt-2">
			{crags.length === 0 && !showForm && (
				<p className="text-sm text-stone-500 px-2 py-1">No crags yet</p>
			)}

			<div className="flex flex-col gap-1">
				{crags.map((crag) => (
					<button
						key={crag.id}
						type="button"
						className="text-sm text-left py-2 px-2 rounded-lg bg-stone-700 hover:bg-stone-600 flex items-center justify-between"
						onClick={() =>
							crag.status === "pending"
								? undefined
								: navigate({
										to: "/crags/$cragId",
										params: { cragId: crag.id },
									})
						}
					>
						<span>{crag.name}</span>
						{crag.status === "pending" && (
							<span className="text-xs text-amber-400 ml-2">pending</span>
						)}
					</button>
				))}
			</div>

			{showForm ? (
				<InlineAddForm
					placeholder="Crag name"
					pending={submitCrag.isPending}
					onSubmit={handleAddCrag}
					onCancel={() => setShowForm(false)}
				/>
			) : (
				<button
					type="button"
					onClick={() => setShowForm(true)}
					className="mt-2 text-xs text-stone-400 hover:text-stone-200"
				>
					+ Add crag
				</button>
			)}
		</div>
	);
};

// ── Region view ───────────────────────────────────────────────────────────────

const RegionView = () => {
	const { regionId } = useParams({ from: "/regions/$regionId" });
	const router = useRouter();
	const { data: subRegions = [] } = useSubRegions(regionId);
	const submitSubRegion = useSubmitSubRegion();
	const [selectedSubRegionId, setSelectedSubRegionId] = useState<string | null>(
		null,
	);
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
				onClick={() => router.history.back()}
			>
				← Back
			</button>

			{subRegions.length === 0 && !showSubRegionForm && (
				<p className="text-stone-400 text-sm">No areas in this region yet.</p>
			)}

			{subRegions.map((sr) => (
				<div key={sr.id} className="rounded-lg bg-stone-800 p-4">
					<button
						type="button"
						className="w-full text-left font-medium flex items-center justify-between"
						onClick={() =>
							setSelectedSubRegionId(
								selectedSubRegionId === sr.id ? null : sr.id,
							)
						}
					>
						<span>{sr.name}</span>
						{sr.status === "pending" && (
							<span className="text-xs text-amber-400">pending</span>
						)}
					</button>

					{selectedSubRegionId === sr.id && <CragList subRegionId={sr.id} />}
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
					className="text-sm text-stone-400 hover:text-stone-200 text-left"
				>
					+ Add sub-area
				</button>
			)}
		</div>
	);
};

export default RegionView;
