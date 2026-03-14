import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { CoordinatePicker } from "@/components/molecules/CoordinatePicker";
import {
	useAdminUpdateCragCoords,
	usePendingLocations,
	useRejectLocation,
	useVerifyLocation,
} from "@/features/locations/locations.queries";
import type { PendingLocationItem } from "@/features/locations/locations.service";

const typeLabel: Record<PendingLocationItem["type"], string> = {
	sub_region: "Sub-area",
	crag: "Crag",
	wall: "Wall",
};

const tableFor = (
	type: PendingLocationItem["type"],
): "sub_regions" | "crags" | "walls" => {
	if (type === "sub_region") return "sub_regions";
	if (type === "crag") return "crags";
	return "walls";
};

const CragCoordEditor = ({ itemId }: { itemId: string }) => {
	const updateCoords = useAdminUpdateCragCoords();
	const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
		null,
	);
	const [showPicker, setShowPicker] = useState(false);

	return (
		<div className="flex flex-col gap-2 mt-2">
			{coords && (
				<p className="text-xs text-text-secondary">
					Location: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
				</p>
			)}
			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => setShowPicker(true)}
					className="text-sm text-accent-primary text-left"
				>
					{coords ? "Change location" : "+ Set location"}
				</button>
				{coords && (
					<button
						type="button"
						disabled={updateCoords.isPending}
						onClick={() =>
							updateCoords.mutate({
								id: itemId,
								lat: coords.lat,
								lng: coords.lng,
							})
						}
						className="text-sm px-3 py-1.5 rounded-[var(--radius-md)] bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-40 font-semibold"
					>
						{updateCoords.isPending ? "..." : "Save"}
					</button>
				)}
			</div>
			{showPicker && (
				<CoordinatePicker
					value={coords}
					onChange={setCoords}
					onClose={() => setShowPicker(false)}
				/>
			)}
		</div>
	);
};

const LocationVerificationView = () => {
	const router = useRouter();
	const { data: items = [], isLoading } = usePendingLocations();
	const verify = useVerifyLocation();
	const reject = useRejectLocation();

	return (
		<div className="flex flex-col gap-4">
			<button
				type="button"
				className="text-text-secondary text-sm text-left"
				onClick={() => router.history.back()}
			>
				← Back
			</button>

			<h1 className="text-lg font-display font-semibold">Pending Locations</h1>

			{isLoading && <p className="text-text-secondary text-sm">Loading…</p>}

			{!isLoading && items.length === 0 && (
				<p className="text-text-secondary text-sm">No pending submissions.</p>
			)}

			<div className="flex flex-col gap-3">
				{items.map((item) => (
					<div
						key={item.id}
						className="rounded-lg bg-surface-card p-4 flex flex-col gap-2"
					>
						<div className="flex items-start justify-between gap-2">
							<div>
								<p className="font-medium">{item.name}</p>
								<p className="text-xs text-text-secondary mt-0.5">
									{typeLabel[item.type]} · in {item.parent_name}
								</p>
							</div>
							<span className="text-xs text-amber-400 shrink-0">pending</span>
						</div>

						{item.type === "crag" && <CragCoordEditor itemId={item.id} />}

						<div className="flex gap-2 mt-1">
							<button
								type="button"
								disabled={verify.isPending || reject.isPending}
								onClick={() =>
									verify.mutate({ table: tableFor(item.type), id: item.id })
								}
								className="flex-1 text-sm py-2 rounded-lg bg-accent-primary hover:bg-accent-primary/90 disabled:opacity-40"
							>
								Verify
							</button>
							<button
								type="button"
								disabled={verify.isPending || reject.isPending}
								onClick={() =>
									reject.mutate({ table: tableFor(item.type), id: item.id })
								}
								className="flex-1 text-sm py-2 rounded-lg bg-red-800 hover:bg-red-700 disabled:opacity-40"
							>
								Reject
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default LocationVerificationView;
