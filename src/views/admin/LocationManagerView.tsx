import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { ConfirmDeleteDialog } from "@/components/molecules/ConfirmDeleteDialog";
import {
	useAdminAddCountry,
	useAdminAddRegion,
	useAdminDeleteCountry,
	useAdminDeleteRegion,
	useCountries,
	useRegions,
} from "@/features/locations/locations.queries";
import { useUiStore } from "@/stores/ui.store";

const LocationManagerView = () => {
	const addToast = useUiStore((s) => s.addToast);

	const { data: countries = [] } = useCountries();
	const [selectedCountryId, setSelectedCountryId] = useState<string | null>(
		null,
	);
	const { data: regions = [] } = useRegions(selectedCountryId);

	const [newCountryName, setNewCountryName] = useState("");
	const [newCountryCode, setNewCountryCode] = useState("");
	const [newRegionName, setNewRegionName] = useState("");

	const { mutate: addCountry } = useAdminAddCountry();
	const { mutate: deleteCountry } = useAdminDeleteCountry();
	const { mutate: addRegion } = useAdminAddRegion();
	const { mutate: deleteRegion } = useAdminDeleteRegion();

	const [pendingDeleteCountry, setPendingDeleteCountry] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [pendingDeleteRegion, setPendingDeleteRegion] = useState<{
		id: string;
		name: string;
	} | null>(null);

	const handleAddCountry = () => {
		const name = newCountryName.trim();
		const code = newCountryCode.trim().toUpperCase();
		if (!name || !code) return;
		addCountry(
			{ name, code, sortOrder: countries.length },
			{
				onSuccess: () => {
					setNewCountryName("");
					setNewCountryCode("");
					addToast({ message: `${name} added`, type: "success" });
				},
				onError: () =>
					addToast({ message: "Failed to add country", type: "error" }),
			},
		);
	};

	const handleDeleteCountry = (id: string, name: string) => {
		deleteCountry(id, {
			onSuccess: () => {
				if (selectedCountryId === id) setSelectedCountryId(null);
				addToast({ message: `${name} deleted`, type: "success" });
			},
			onError: () =>
				addToast({ message: "Failed to delete country", type: "error" }),
		});
	};

	const handleAddRegion = () => {
		const name = newRegionName.trim();
		if (!name || !selectedCountryId) return;
		addRegion(
			{ countryId: selectedCountryId, name, sortOrder: regions.length },
			{
				onSuccess: () => {
					setNewRegionName("");
					addToast({ message: `${name} added`, type: "success" });
				},
				onError: () =>
					addToast({ message: "Failed to add region", type: "error" }),
			},
		);
	};

	const handleDeleteRegion = (id: string, name: string) => {
		if (!selectedCountryId) return;
		deleteRegion(
			{ id, countryId: selectedCountryId },
			{
				onSuccess: () =>
					addToast({ message: `${name} deleted`, type: "success" }),
				onError: () =>
					addToast({ message: "Failed to delete region", type: "error" }),
			},
		);
	};

	return (
		<div className="flex flex-col gap-6">
			<h1 className="text-lg font-display font-semibold">Location Manager</h1>

			{/* Countries */}
			<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-3">
				<p className="text-xs text-text-secondary uppercase tracking-wide">
					Countries
				</p>
				<div className="flex gap-2">
					<Input
						placeholder="Name"
						value={newCountryName}
						onChange={(e) => setNewCountryName(e.target.value)}
					/>
					<Input
						placeholder="Code (e.g. US)"
						value={newCountryCode}
						onChange={(e) => setNewCountryCode(e.target.value)}
						className="w-28"
					/>
					<Button type="button" variant="primary" onClick={handleAddCountry}>
						Add
					</Button>
				</div>
				<div className="flex flex-col gap-1">
					{countries.map((c) => (
						<div
							key={c.id}
							className="flex items-center justify-between py-1 border-b border-border-default last:border-0"
						>
							<button
								type="button"
								className={`text-sm text-left flex-1 ${selectedCountryId === c.id ? "text-accent-primary" : "text-text-primary"}`}
								onClick={() =>
									setSelectedCountryId(selectedCountryId === c.id ? null : c.id)
								}
							>
								{c.name} ({c.code})
							</button>
							{c.region_count === 0 && (
								<Button
									type="button"
									variant="secondary"
									size="small"
									onClick={() =>
										setPendingDeleteCountry({ id: c.id, name: c.name })
									}
								>
									Delete
								</Button>
							)}
						</div>
					))}
					{countries.length === 0 && (
						<p className="text-sm text-text-tertiary">No countries yet</p>
					)}
				</div>
			</div>

			{/* Regions */}
			{selectedCountryId && (
				<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-3">
					<p className="text-xs text-text-secondary uppercase tracking-wide">
						Regions — {countries.find((c) => c.id === selectedCountryId)?.name}
					</p>
					<div className="flex gap-2">
						<Input
							placeholder="Region name"
							value={newRegionName}
							onChange={(e) => setNewRegionName(e.target.value)}
						/>
						<Button type="button" variant="primary" onClick={handleAddRegion}>
							Add
						</Button>
					</div>
					<div className="flex flex-col gap-1">
						{regions.map((r) => (
							<div
								key={r.id}
								className="flex items-center justify-between py-1 border-b border-border-default last:border-0"
							>
								<span className="text-sm">{r.name}</span>
								{r.sub_region_count === 0 && (
									<Button
										type="button"
										variant="secondary"
										size="small"
										onClick={() =>
											setPendingDeleteRegion({ id: r.id, name: r.name })
										}
									>
										Delete
									</Button>
								)}
							</div>
						))}
						{regions.length === 0 && (
							<p className="text-sm text-text-tertiary">No regions yet</p>
						)}
					</div>
				</div>
			)}

			<ConfirmDeleteDialog
				isOpen={pendingDeleteCountry !== null}
				title="Delete country"
				message={`Are you sure you want to delete "${pendingDeleteCountry?.name}"?`}
				onConfirm={() => {
					if (pendingDeleteCountry)
						handleDeleteCountry(
							pendingDeleteCountry.id,
							pendingDeleteCountry.name,
						);
					setPendingDeleteCountry(null);
				}}
				onCancel={() => setPendingDeleteCountry(null)}
			/>

			<ConfirmDeleteDialog
				isOpen={pendingDeleteRegion !== null}
				title="Delete region"
				message={`Are you sure you want to delete "${pendingDeleteRegion?.name}"?`}
				onConfirm={() => {
					if (pendingDeleteRegion)
						handleDeleteRegion(
							pendingDeleteRegion.id,
							pendingDeleteRegion.name,
						);
					setPendingDeleteRegion(null);
				}}
				onCancel={() => setPendingDeleteRegion(null)}
			/>
		</div>
	);
};

export default LocationManagerView;
