import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/atoms/Select";
import { Spinner } from "@/components/atoms/Spinner";
import {
	useAdminAddCountry,
	useAdminAddCrag,
	useAdminAddRegion,
	useAdminAddSubRegion,
	useAdminAddWall,
	useCountries,
	useCrags,
	useRegions,
	useSubRegions,
	useWalls,
} from "@/features/locations/locations.queries";
import type {
	Country,
	Crag,
	Region,
	SubRegion,
	Wall,
} from "@/features/locations/locations.schema";
import { useUiStore } from "@/stores/ui.store";

// Stable empty-array references — avoids infinite useEffect loops caused by
// new `[]` literals on every render when query data is undefined.
const NO_COUNTRIES: Country[] = [];
const NO_REGIONS: Region[] = [];
const NO_SUB_REGIONS: SubRegion[] = [];
const NO_CRAGS: Crag[] = [];
const NO_WALLS: Wall[] = [];

const ADD_SENTINEL = "__add__";

export type LocationSelection = {
	countryId: string | null;
	regionId: string | null;
	subRegionId: string | null;
	cragId: string | null;
	wallId: string | null;
	wall: Wall | null;
};

export type LocationDrillDownProps = {
	onChange: (selection: LocationSelection) => void;
	/** Deepest level to show. Defaults to "wall". */
	stopAt?: "region" | "sub_region" | "crag" | "wall";
	/** Pre-populate the selector (edit mode). */
	initial?: {
		countryId?: string;
		regionId?: string;
		subRegionId?: string;
		cragId?: string;
		wallId?: string;
	};
	/**
	 * When true, sub-region / crag / wall selects include an "＋ Add new …"
	 * option that lets an admin create the location inline.
	 */
	allowAdd?: boolean;
};

// ── Inline add input ──────────────────────────────────────────────────────────

function InlineAdd({
	placeholder,
	isPending,
	onSave,
	onCancel,
}: {
	placeholder: string;
	isPending: boolean;
	onSave: (name: string) => Promise<void>;
	onCancel: () => void;
}) {
	const [name, setName] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []); // eslint-disable-line -- focus on mount only

	const handleSave = async () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		await onSave(trimmed);
	};

	return (
		<div className="flex items-center gap-2">
			<input
				ref={inputRef}
				placeholder={placeholder}
				value={name}
				onChange={(e) => setName(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") handleSave();
					if (e.key === "Escape") onCancel();
				}}
				disabled={isPending}
				className="flex-1 text-sm bg-transparent outline-0 text-text-primary placeholder:text-text-tertiary border-b border-border-input pb-0.5"
			/>
			<button
				type="button"
				onClick={handleSave}
				disabled={isPending || !name.trim()}
				className="text-accent-primary text-sm disabled:opacity-40"
			>
				{isPending ? <Spinner size="sm" /> : "✓"}
			</button>
			<button
				type="button"
				onClick={onCancel}
				disabled={isPending}
				className="text-text-tertiary text-sm"
			>
				✗
			</button>
		</div>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

export function LocationDrillDown({
	onChange,
	stopAt = "wall",
	initial,
	allowAdd = false,
}: LocationDrillDownProps) {
	const [countryId, setCountryId] = useState<string>(initial?.countryId ?? "");
	const [regionId, setRegionId] = useState<string>(initial?.regionId ?? "");
	const [subRegionId, setSubRegionId] = useState<string>(
		initial?.subRegionId ?? "",
	);
	const [cragId, setCragId] = useState<string>(initial?.cragId ?? "");
	const [wallId, setWallId] = useState<string>(initial?.wallId ?? "");

	// Which level currently has the inline add input open
	const [addingLevel, setAddingLevel] = useState<
		"country" | "region" | "sub_region" | "crag" | "wall" | null
	>(null);

	const { data: countries = NO_COUNTRIES } = useCountries();
	const { data: regions = NO_REGIONS } = useRegions(countryId || null);
	const { data: subRegions = NO_SUB_REGIONS } = useSubRegions(
		regionId && stopAt !== "region" ? regionId : null,
	);
	const { data: crags = NO_CRAGS } = useCrags(
		subRegionId && stopAt !== "region" && stopAt !== "sub_region"
			? subRegionId
			: null,
	);
	const { data: walls = NO_WALLS } = useWalls(
		cragId && stopAt === "wall" ? cragId : null,
	);

	const addToast = useUiStore((s) => s.addToast);

	const { mutateAsync: addCountry, isPending: addingCountry } =
		useAdminAddCountry();
	const { mutateAsync: addRegion, isPending: addingRegion } =
		useAdminAddRegion();
	const { mutateAsync: addSubRegion, isPending: addingSR } =
		useAdminAddSubRegion();
	const { mutateAsync: addCrag, isPending: addingCrag } = useAdminAddCrag();
	const { mutateAsync: addWall, isPending: addingWall } = useAdminAddWall();

	// Notify parent whenever selection changes
	useEffect(() => {
		const wall = wallId ? (walls.find((w) => w.id === wallId) ?? null) : null;
		onChange({
			countryId: countryId || null,
			regionId: regionId || null,
			subRegionId: subRegionId || null,
			cragId: cragId || null,
			wallId: wallId || null,
			wall,
		});
	}, [countryId, regionId, subRegionId, cragId, wallId, walls, onChange]);

	const handleCountryChange = (id: string) => {
		if (id === ADD_SENTINEL) {
			setCountryId("");
			setAddingLevel("country");
			return;
		}
		setCountryId(id);
		setRegionId("");
		setSubRegionId("");
		setCragId("");
		setWallId("");
		setAddingLevel(null);
	};

	const handleRegionChange = (id: string) => {
		if (id === ADD_SENTINEL) {
			setRegionId("");
			setAddingLevel("region");
			return;
		}
		setRegionId(id);
		setSubRegionId("");
		setCragId("");
		setWallId("");
		setAddingLevel(null);
	};

	const handleSubRegionChange = (id: string) => {
		if (id === ADD_SENTINEL) {
			setSubRegionId("");
			setAddingLevel("sub_region");
			return;
		}
		setSubRegionId(id);
		setCragId("");
		setWallId("");
		setAddingLevel(null);
	};

	const handleCragChange = (id: string) => {
		if (id === ADD_SENTINEL) {
			setCragId("");
			setAddingLevel("crag");
			return;
		}
		setCragId(id);
		setWallId("");
		setAddingLevel(null);
	};

	const handleWallChange = (id: string) => {
		if (id === ADD_SENTINEL) {
			setWallId("");
			setAddingLevel("wall");
			return;
		}
		setWallId(id);
		setAddingLevel(null);
	};

	return (
		<div className="flex flex-col gap-3">
			{/* Country */}
			<Select
				variant="text"
				value={countryId}
				onChange={(e) => handleCountryChange(e.target.value)}
			>
				<option value="">Country…</option>
				{countries.map((c) => (
					<option key={c.id} value={c.id}>
						{c.name}
					</option>
				))}
				{allowAdd && <option value={ADD_SENTINEL}>＋ Add new country…</option>}
			</Select>
			{allowAdd && addingLevel === "country" && (
				<InlineAdd
					placeholder="Country name…"
					isPending={addingCountry}
					onSave={async (name) => {
						const { id } = await addCountry({ name });
						setCountryId(id);
						setRegionId("");
						setSubRegionId("");
						setCragId("");
						setWallId("");
						setAddingLevel(null);
						addToast({ message: `Country "${name}" added`, type: "success" });
					}}
					onCancel={() => setAddingLevel(null)}
				/>
			)}

			{/* Region */}
			{countryId && (
				<>
					<Select
						variant="text"
						value={regionId}
						onChange={(e) => handleRegionChange(e.target.value)}
					>
						<option value="">Region…</option>
						{regions.map((r) => (
							<option key={r.id} value={r.id}>
								{r.name}
							</option>
						))}
						{allowAdd && (
							<option value={ADD_SENTINEL}>＋ Add new region…</option>
						)}
					</Select>
					{allowAdd && addingLevel === "region" && (
						<InlineAdd
							placeholder="Region name…"
							isPending={addingRegion}
							onSave={async (name) => {
								const { id } = await addRegion({ countryId, name });
								setRegionId(id);
								setSubRegionId("");
								setCragId("");
								setWallId("");
								setAddingLevel(null);
								addToast({
									message: `Region "${name}" added`,
									type: "success",
								});
							}}
							onCancel={() => setAddingLevel(null)}
						/>
					)}
				</>
			)}

			{/* Sub-Region */}
			{regionId && stopAt !== "region" && (
				<>
					<Select
						variant="text"
						value={subRegionId}
						onChange={(e) => handleSubRegionChange(e.target.value)}
					>
						<option value="">Area…</option>
						{subRegions.map((sr) => (
							<option key={sr.id} value={sr.id}>
								{sr.name}
							</option>
						))}
						{allowAdd && <option value={ADD_SENTINEL}>＋ Add new area…</option>}
					</Select>
					{allowAdd && addingLevel === "sub_region" && (
						<InlineAdd
							placeholder="Area name…"
							isPending={addingSR}
							onSave={async (name) => {
								const { id } = await addSubRegion({
									region_id: regionId,
									name,
								});
								setSubRegionId(id);
								setCragId("");
								setWallId("");
								setAddingLevel(null);
								addToast({ message: `Area "${name}" added`, type: "success" });
							}}
							onCancel={() => setAddingLevel(null)}
						/>
					)}
				</>
			)}

			{/* Crag */}
			{subRegionId && stopAt !== "region" && stopAt !== "sub_region" && (
				<>
					<Select
						variant="text"
						value={cragId}
						onChange={(e) => handleCragChange(e.target.value)}
					>
						<option value="">Crag…</option>
						{crags.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name}
							</option>
						))}
						{allowAdd && <option value={ADD_SENTINEL}>＋ Add new crag…</option>}
					</Select>
					{allowAdd && addingLevel === "crag" && (
						<InlineAdd
							placeholder="Crag name…"
							isPending={addingCrag}
							onSave={async (name) => {
								const { id } = await addCrag({
									sub_region_id: subRegionId,
									name,
								});
								setCragId(id);
								setWallId("");
								setAddingLevel(null);
								addToast({ message: `Crag "${name}" added`, type: "success" });
							}}
							onCancel={() => setAddingLevel(null)}
						/>
					)}
				</>
			)}

			{/* Wall */}
			{cragId && stopAt === "wall" && (
				<>
					<Select
						variant="text"
						value={wallId}
						onChange={(e) => handleWallChange(e.target.value)}
					>
						<option value="">Wall…</option>
						{walls.map((w) => (
							<option key={w.id} value={w.id}>
								{w.name}
							</option>
						))}
						{allowAdd && <option value={ADD_SENTINEL}>＋ Add new wall…</option>}
					</Select>
					{allowAdd && addingLevel === "wall" && (
						<InlineAdd
							placeholder="Wall name…"
							isPending={addingWall}
							onSave={async (name) => {
								const { id } = await addWall({
									crag_id: cragId,
									name,
									wall_type: "wall",
								});
								setWallId(id);
								setAddingLevel(null);
								addToast({ message: `Wall "${name}" added`, type: "success" });
							}}
							onCancel={() => setAddingLevel(null)}
						/>
					)}
				</>
			)}
		</div>
	);
}
