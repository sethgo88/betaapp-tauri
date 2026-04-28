import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/atoms/Button";
import {
	useCountries,
	useDownloadedRegionIds,
	useDownloadRegion,
	useRegions,
	useStaleRegionIds,
} from "@/features/locations/locations.queries";

const RegionList = ({
	countryId,
	downloadedIds,
	staleIds,
}: {
	countryId: string;
	downloadedIds: string[];
	staleIds: string[];
}) => {
	const navigate = useNavigate();
	const { data: regions = [] } = useRegions(countryId);
	const {
		mutate: download,
		isPending,
		variables: downloadingId,
	} = useDownloadRegion();

	if (regions.length === 0) {
		return (
			<p className="text-sm text-text-on-light px-2 py-1">No regions yet</p>
		);
	}

	return (
		<div className="flex flex-col gap-1 mt-2">
			{regions.map((region) => {
				const isDownloaded = downloadedIds.includes(region.id);
				const isStale = isDownloaded && staleIds.includes(region.id);
				const isThisDownloading = isPending && downloadingId === region.id;

				return (
					<div
						key={region.id}
						className="flex items-center justify-between py-2 px-2 rounded-lg bg-surface-page"
					>
						<button
							type="button"
							className={`text-sm text-left flex-1 ${isDownloaded ? "text-text-primary" : "text-text-on-light/60"}`}
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
							<div className="flex items-center gap-2">
								{isStale ? (
									<span className="text-xs text-amber-400">Outdated</span>
								) : (
									<span className="text-xs text-accent-primary">
										Downloaded
									</span>
								)}
								<Button
									type="button"
									variant="secondary"
									size="small"
									onClick={() => download(region.id)}
									disabled={isThisDownloading}
								>
									{isThisDownloading ? "…" : "Refresh"}
								</Button>
							</div>
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
	const { data: staleIds = [] } = useStaleRegionIds();

	return (
		<div className="flex flex-col gap-3">
			<h1 className="text-lg font-display font-semibold text-white">
				Route Manager
			</h1>

			{countries.length === 0 && (
				<p className="text-white text-sm">No locations available yet.</p>
			)}

			{countries.map((country) => (
				<div key={country.id} className="rounded-lg bg-surface-card p-4">
					<div className="flex items-center justify-between">
						<span className="font-medium">{country.name}</span>
						<span className="text-text-on-light text-sm">{country.code}</span>
					</div>
					<RegionList
						countryId={country.id}
						downloadedIds={downloadedIds}
						staleIds={staleIds}
					/>
				</div>
			))}
		</div>
	);
};

export default RoutesView;
