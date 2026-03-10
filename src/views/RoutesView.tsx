import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import {
	useCountries,
	useDownloadedRegionIds,
	useDownloadRegion,
	useRegions,
} from "@/features/locations/locations.queries";

const RegionList = ({
	countryId,
	downloadedIds,
}: {
	countryId: string;
	downloadedIds: string[];
}) => {
	const navigate = useNavigate();
	const { data: regions = [] } = useRegions(countryId);
	const {
		mutate: download,
		isPending,
		variables: downloadingId,
	} = useDownloadRegion();

	if (regions.length === 0) {
		return <p className="text-sm text-stone-500 px-2 py-1">No regions yet</p>;
	}

	return (
		<div className="flex flex-col gap-1 mt-2">
			{regions.map((region) => {
				const isDownloaded = downloadedIds.includes(region.id);
				const isThisDownloading = isPending && downloadingId === region.id;

				return (
					<div
						key={region.id}
						className="flex items-center justify-between py-2 px-2 rounded-lg bg-stone-700"
					>
						<button
							type="button"
							className={`text-sm text-left flex-1 ${isDownloaded ? "text-white" : "text-stone-400"}`}
							onClick={() =>
								isDownloaded &&
								navigate({
									to: "/regions/$regionId",
									params: { regionId: region.id },
								})
							}
						>
							{region.name}
						</button>
						{isDownloaded ? (
							<span className="text-xs text-emerald-400">Downloaded</span>
						) : (
							<Button
								type="button"
								variant="secondary"
								size="small"
								onClick={() => download(region.id)}
								disabled={isThisDownloading}
							>
								{isThisDownloading ? "…" : "Download"}
							</Button>
						)}
					</div>
				);
			})}
		</div>
	);
};

const RoutesView = () => {
	const { data: countries = [] } = useCountries();
	const { data: downloadedIds = [] } = useDownloadedRegionIds();
	const [selectedCountryId, setSelectedCountryId] = useState<string | null>(
		null,
	);

	return (
		<div className="flex flex-col gap-3">
			<h1 className="text-lg font-semibold">Routes</h1>

			{countries.length === 0 && (
				<p className="text-stone-400 text-sm">No locations available yet.</p>
			)}

			{countries.map((country) => (
				<div key={country.id} className="rounded-lg bg-stone-800 p-4">
					<button
						type="button"
						className="w-full flex items-center justify-between"
						onClick={() =>
							setSelectedCountryId(
								selectedCountryId === country.id ? null : country.id,
							)
						}
					>
						<span className="font-medium">{country.name}</span>
						<span className="text-stone-400 text-sm">{country.code}</span>
					</button>

					{selectedCountryId === country.id && (
						<RegionList countryId={country.id} downloadedIds={downloadedIds} />
					)}
				</div>
			))}
		</div>
	);
};

export default RoutesView;
