import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
	useCrags,
	useSubRegions,
} from "@/features/locations/locations.queries";

const CragList = ({ subRegionId }: { subRegionId: string }) => {
	const navigate = useNavigate();
	const { data: crags = [] } = useCrags(subRegionId);

	if (crags.length === 0) {
		return <p className="text-sm text-stone-500 px-2 py-1">No crags yet</p>;
	}

	return (
		<div className="flex flex-col gap-1 mt-2">
			{crags.map((crag) => (
				<button
					key={crag.id}
					type="button"
					className="text-sm text-left py-2 px-2 rounded-lg bg-stone-700 hover:bg-stone-600"
					onClick={() =>
						navigate({ to: "/crags/$cragId", params: { cragId: crag.id } })
					}
				>
					{crag.name}
				</button>
			))}
		</div>
	);
};

const RegionView = () => {
	const { regionId } = useParams({ from: "/regions/$regionId" });
	const router = useRouter();
	const { data: subRegions = [] } = useSubRegions(regionId);
	const [selectedSubRegionId, setSelectedSubRegionId] = useState<string | null>(
		null,
	);

	return (
		<div className="flex flex-col gap-3">
			<button
				type="button"
				className="text-stone-400 text-sm text-left"
				onClick={() => router.history.back()}
			>
				← Back
			</button>

			{subRegions.length === 0 && (
				<p className="text-stone-400 text-sm">No areas in this region yet.</p>
			)}

			{subRegions.map((sr) => (
				<div key={sr.id} className="rounded-lg bg-stone-800 p-4">
					<button
						type="button"
						className="w-full text-left font-medium"
						onClick={() =>
							setSelectedSubRegionId(
								selectedSubRegionId === sr.id ? null : sr.id,
							)
						}
					>
						{sr.name}
					</button>

					{selectedSubRegionId === sr.id && <CragList subRegionId={sr.id} />}
				</div>
			))}
		</div>
	);
};

export default RegionView;
