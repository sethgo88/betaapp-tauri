import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { CoordinatePicker } from "@/components/molecules/CoordinatePicker";
import { useGrades } from "@/features/grades/grades.queries";
import {
	useAdminUpdateCragCoords,
	usePendingLocations,
	useRejectLocation,
	useVerifyLocation,
} from "@/features/locations/locations.queries";
import type { PendingLocationItem } from "@/features/locations/locations.service";
import {
	useMergeRoute,
	useRejectRoute,
	useUnverifiedRoutes,
	useUpdateRouteFields,
	useVerifyRoute,
} from "@/features/routes/routes.queries";
import {
	searchVerifiedRoutes,
	type UnverifiedRoute,
	type VerifiedRouteResult,
} from "@/features/routes/routes.service";
import { useUiStore } from "@/stores/ui.store";

// ── Shared ────────────────────────────────────────────────────────────────────

const SectionHeader = ({
	title,
	count,
	open,
	onToggle,
}: {
	title: string;
	count: number;
	open: boolean;
	onToggle: () => void;
}) => (
	<button
		type="button"
		className="flex items-center justify-between w-full py-3 px-1 text-left"
		onClick={onToggle}
	>
		<div className="flex items-center gap-2">
			<span className="font-display font-semibold">{title}</span>
			<span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">
				{count}
			</span>
		</div>
		<span className="text-text-secondary text-sm">{open ? "▲" : "▼"}</span>
	</button>
);

// ── Route section ─────────────────────────────────────────────────────────────

function locationLabel(route: UnverifiedRoute): string {
	const w = route.walls;
	if (!w) return "Unknown location";
	const sr = w.crags.sub_regions;
	const r = sr.regions;
	return `${r.countries.name} / ${r.name} / ${sr.name} / ${w.crags.name} / ${w.name}`;
}

const EditRouteForm = ({
	route,
	onSave,
	onCancel,
}: {
	route: UnverifiedRoute;
	onSave: (values: {
		name: string;
		grade: string;
		route_type: "sport" | "boulder";
		description?: string;
	}) => void;
	onCancel: () => void;
}) => {
	const [name, setName] = useState(route.name);
	const [routeType, setRouteType] = useState<"sport" | "boulder">(
		route.route_type,
	);
	const [grade, setGrade] = useState(route.grade);
	const [description, setDescription] = useState(route.description ?? "");
	const { data: grades = [] } = useGrades(routeType);

	return (
		<div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border-default">
			<Input
				placeholder="Route name"
				value={name}
				onChange={(e) => setName(e.target.value)}
			/>
			<Select
				value={routeType}
				onChange={(e) => {
					const val = e.target.value as "sport" | "boulder";
					setRouteType(val);
					setGrade("");
				}}
			>
				<option value="sport">Sport</option>
				<option value="boulder">Boulder</option>
			</Select>
			<Select
				value={grade || (grades.length > 0 ? grades[0].grade : "")}
				onChange={(e) => setGrade(e.target.value)}
			>
				{grades.map((g) => (
					<option key={g.id} value={g.grade}>
						{g.grade}
					</option>
				))}
			</Select>
			<textarea
				placeholder="Description (optional)"
				value={description}
				onChange={(e) => setDescription(e.target.value)}
				rows={2}
				className="rounded-lg bg-surface-page p-2 outline-0 w-full border border-border-default resize-none text-sm text-text-primary"
			/>
			<div className="flex gap-2">
				<Button
					type="button"
					variant="primary"
					size="small"
					onClick={() =>
						onSave({
							name,
							grade: grade || (grades.length > 0 ? grades[0].grade : ""),
							route_type: routeType,
							description: description || undefined,
						})
					}
				>
					Save
				</Button>
				<Button
					type="button"
					variant="secondary"
					size="small"
					onClick={onCancel}
				>
					Cancel
				</Button>
			</div>
		</div>
	);
};

const MergeSearch = ({
	onMerge,
	onCancel,
}: {
	onMerge: (targetRoute: VerifiedRouteResult) => void;
	onCancel: () => void;
}) => {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<VerifiedRouteResult[]>([]);
	const [searching, setSearching] = useState(false);

	const handleSearch = async () => {
		if (!query.trim()) return;
		setSearching(true);
		try {
			const found = await searchVerifiedRoutes(query.trim());
			setResults(found);
		} finally {
			setSearching(false);
		}
	};

	return (
		<div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border-default">
			<p className="text-xs text-text-secondary">
				Search for the existing verified route to merge into:
			</p>
			<div className="flex gap-2">
				<Input
					placeholder="Route name…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleSearch()}
				/>
				<Button
					type="button"
					variant="secondary"
					size="small"
					onClick={handleSearch}
					disabled={searching}
				>
					{searching ? "…" : "Search"}
				</Button>
			</div>
			{results.length > 0 && (
				<div className="flex flex-col gap-1">
					{results.map((r) => (
						<button
							key={r.id}
							type="button"
							className="flex items-center justify-between py-2 px-2 rounded-lg bg-surface-page hover:bg-surface-hover text-left"
							onClick={() => onMerge(r)}
						>
							<span className="text-sm">{r.name}</span>
							<span className="text-xs text-text-secondary">
								{r.grade} · {r.walls?.name}
							</span>
						</button>
					))}
				</div>
			)}
			{results.length === 0 && query && !searching && (
				<p className="text-xs text-text-tertiary">No verified routes found.</p>
			)}
			<Button type="button" variant="secondary" size="small" onClick={onCancel}>
				Cancel
			</Button>
		</div>
	);
};

const RouteRow = ({ route }: { route: UnverifiedRoute }) => {
	const addToast = useUiStore((s) => s.addToast);
	const [mode, setMode] = useState<"idle" | "edit" | "merge">("idle");

	const { mutate: verify } = useVerifyRoute();
	const { mutate: reject } = useRejectRoute();
	const { mutate: updateFields } = useUpdateRouteFields();
	const { mutate: merge } = useMergeRoute();

	const handleVerify = () => {
		verify(route.id, {
			onSuccess: () => addToast({ message: "Route approved", type: "success" }),
			onError: () => addToast({ message: "Failed to approve", type: "error" }),
		});
	};

	const handleReject = () => {
		reject(route.id, {
			onSuccess: () => addToast({ message: "Route rejected", type: "success" }),
			onError: () => addToast({ message: "Failed to reject", type: "error" }),
		});
	};

	const handleSaveEdit = (values: {
		name: string;
		grade: string;
		route_type: "sport" | "boulder";
		description?: string;
	}) => {
		updateFields(
			{ id: route.id, values },
			{
				onSuccess: () => {
					setMode("idle");
					addToast({ message: "Route updated", type: "success" });
				},
				onError: () => addToast({ message: "Failed to update", type: "error" }),
			},
		);
	};

	const handleMerge = (target: VerifiedRouteResult) => {
		merge(
			{ unverifiedId: route.id, targetId: target.id },
			{
				onSuccess: () => {
					setMode("idle");
					addToast({
						message: `Merged into "${target.name}"`,
						type: "success",
					});
				},
				onError: () => addToast({ message: "Failed to merge", type: "error" }),
			},
		);
	};

	return (
		<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-1">
			<p className="text-xs text-text-secondary">{locationLabel(route)}</p>
			<div className="flex items-center justify-between">
				<div>
					<span className="font-medium">{route.name}</span>
					<span className="text-xs text-text-secondary ml-2">
						{route.grade} · {route.route_type}
					</span>
				</div>
				<span className="text-xs text-text-tertiary">
					{new Date(route.created_at).toLocaleDateString()}
				</span>
			</div>

			{mode === "idle" && (
				<div className="flex gap-2 mt-2 flex-wrap">
					<Button
						type="button"
						variant="primary"
						size="small"
						onClick={handleVerify}
					>
						Approve
					</Button>
					<Button
						type="button"
						variant="secondary"
						size="small"
						onClick={() => setMode("edit")}
					>
						Edit
					</Button>
					<Button
						type="button"
						variant="secondary"
						size="small"
						onClick={() => setMode("merge")}
					>
						Merge
					</Button>
					<Button
						type="button"
						variant="secondary"
						size="small"
						onClick={handleReject}
					>
						Reject
					</Button>
				</div>
			)}

			{mode === "edit" && (
				<EditRouteForm
					route={route}
					onSave={handleSaveEdit}
					onCancel={() => setMode("idle")}
				/>
			)}

			{mode === "merge" && (
				<MergeSearch onMerge={handleMerge} onCancel={() => setMode("idle")} />
			)}
		</div>
	);
};

// ── Location section ──────────────────────────────────────────────────────────

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

const LocationRow = ({
	item,
	verify,
	reject,
	isActing,
}: {
	item: PendingLocationItem;
	verify: (item: PendingLocationItem) => void;
	reject: (item: PendingLocationItem) => void;
	isActing: boolean;
}) => (
	<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-2">
		<div className="flex items-start justify-between gap-2">
			<div>
				<p className="font-medium">{item.name}</p>
				<p className="text-xs text-text-secondary mt-0.5">
					{typeLabel[item.type]} · in {item.parent_name}
				</p>
			</div>
			<span className="text-xs text-text-tertiary shrink-0">
				{new Date(item.created_at).toLocaleDateString()}
			</span>
		</div>

		{item.type === "crag" && <CragCoordEditor itemId={item.id} />}

		<div className="flex gap-2 mt-1">
			<Button
				type="button"
				variant="primary"
				size="small"
				disabled={isActing}
				onClick={() => verify(item)}
			>
				Approve
			</Button>
			<Button
				type="button"
				variant="secondary"
				size="small"
				disabled={isActing}
				onClick={() => reject(item)}
			>
				Reject
			</Button>
		</div>
	</div>
);

// ── Main view ─────────────────────────────────────────────────────────────────

const VerificationView = () => {
	const router = useRouter();
	const addToast = useUiStore((s) => s.addToast);

	const { data: routes = [], isLoading: routesLoading } = useUnverifiedRoutes();
	const { data: locations = [], isLoading: locationsLoading } =
		usePendingLocations();

	const verifyLocation = useVerifyLocation();
	const rejectLocation = useRejectLocation();

	const [routesOpen, setRoutesOpen] = useState(true);
	const [locationsOpen, setLocationsOpen] = useState(true);

	const isLoading = routesLoading || locationsLoading;
	const totalPending = routes.length + locations.length;

	const handleVerifyLocation = (item: PendingLocationItem) => {
		verifyLocation.mutate(
			{ table: tableFor(item.type), id: item.id },
			{
				onSuccess: () =>
					addToast({ message: `${item.name} approved`, type: "success" }),
				onError: () =>
					addToast({ message: "Failed to approve", type: "error" }),
			},
		);
	};

	const handleRejectLocation = (item: PendingLocationItem) => {
		rejectLocation.mutate(
			{ table: tableFor(item.type), id: item.id },
			{
				onSuccess: () =>
					addToast({ message: `${item.name} rejected`, type: "success" }),
				onError: () => addToast({ message: "Failed to reject", type: "error" }),
			},
		);
	};

	return (
		<div className="flex flex-col gap-4">
			<button
				type="button"
				className="text-text-secondary text-sm text-left"
				onClick={() => router.history.back()}
			>
				← Back
			</button>

			<h1 className="text-lg font-display font-semibold">Verification</h1>

			{isLoading && <p className="text-text-secondary text-sm">Loading…</p>}

			{!isLoading && totalPending === 0 && (
				<div className="rounded-lg bg-surface-card p-6 text-center">
					<p className="text-text-secondary text-sm">
						No pending submissions. All caught up!
					</p>
				</div>
			)}

			{!isLoading && (
				<>
					{/* Routes section */}
					<div className="flex flex-col">
						<SectionHeader
							title="Routes"
							count={routes.length}
							open={routesOpen}
							onToggle={() => setRoutesOpen((o) => !o)}
						/>
						{routesOpen && (
							<div className="flex flex-col gap-3">
								{routes.length === 0 ? (
									<p className="text-text-tertiary text-sm px-1">
										No pending routes.
									</p>
								) : (
									routes.map((route) => (
										<RouteRow key={route.id} route={route} />
									))
								)}
							</div>
						)}
					</div>

					{/* Divider */}
					<div className="border-t border-border-default" />

					{/* Locations section */}
					<div className="flex flex-col">
						<SectionHeader
							title="Locations"
							count={locations.length}
							open={locationsOpen}
							onToggle={() => setLocationsOpen((o) => !o)}
						/>
						{locationsOpen && (
							<div className="flex flex-col gap-3">
								{locations.length === 0 ? (
									<p className="text-text-tertiary text-sm px-1">
										No pending locations.
									</p>
								) : (
									locations.map((item) => (
										<LocationRow
											key={item.id}
											item={item}
											verify={handleVerifyLocation}
											reject={handleRejectLocation}
											isActing={
												verifyLocation.isPending || rejectLocation.isPending
											}
										/>
									))
								)}
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
};

export default VerificationView;
