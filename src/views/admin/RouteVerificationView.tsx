import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { useGrades } from "@/features/grades/grades.queries";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function locationLabel(route: UnverifiedRoute): string {
	const w = route.walls;
	if (!w) return "Unknown location";
	const sr = w.crags.sub_regions;
	const r = sr.regions;
	return `${r.countries.name} / ${r.name} / ${sr.name} / ${w.crags.name} / ${w.name}`;
}

// ── Inline edit form ──────────────────────────────────────────────────────────

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
		<div className="flex flex-col gap-2 mt-3 pt-3 border-t border-stone-700">
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
				className="rounded-lg bg-stone-700 p-2 outline-0 w-full border border-stone-600 resize-none text-sm"
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

// ── Merge search ──────────────────────────────────────────────────────────────

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
		<div className="flex flex-col gap-2 mt-3 pt-3 border-t border-stone-700">
			<p className="text-xs text-stone-400">
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
							className="flex items-center justify-between py-2 px-2 rounded-lg bg-stone-700 hover:bg-stone-600 text-left"
							onClick={() => onMerge(r)}
						>
							<span className="text-sm">{r.name}</span>
							<span className="text-xs text-stone-400">
								{r.grade} · {r.walls?.name}
							</span>
						</button>
					))}
				</div>
			)}
			{results.length === 0 && query && !searching && (
				<p className="text-xs text-stone-500">No verified routes found.</p>
			)}
			<Button type="button" variant="secondary" size="small" onClick={onCancel}>
				Cancel
			</Button>
		</div>
	);
};

// ── Route row ─────────────────────────────────────────────────────────────────

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
		merge(route.id, {
			onSuccess: () => {
				setMode("idle");
				addToast({
					message: `Merged into "${target.name}"`,
					type: "success",
				});
			},
			onError: () => addToast({ message: "Failed to merge", type: "error" }),
		});
	};

	return (
		<div className="rounded-lg bg-stone-800 p-4 flex flex-col gap-1">
			<p className="text-xs text-stone-400">{locationLabel(route)}</p>
			<div className="flex items-center justify-between">
				<div>
					<span className="font-medium">{route.name}</span>
					<span className="text-xs text-stone-400 ml-2">
						{route.grade} · {route.route_type}
					</span>
				</div>
				<span className="text-xs text-stone-500">
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

// ── Main view ─────────────────────────────────────────────────────────────────

const RouteVerificationView = () => {
	const router = useRouter();
	const { data: routes = [], isLoading } = useUnverifiedRoutes();

	return (
		<div className="flex flex-col gap-4">
			<button
				type="button"
				className="text-stone-400 text-sm text-left"
				onClick={() => router.history.back()}
			>
				← Back
			</button>

			<h1 className="text-lg font-semibold">Route Verification</h1>

			{isLoading && <p className="text-stone-400 text-sm">Loading…</p>}

			{!isLoading && routes.length === 0 && (
				<p className="text-stone-400 text-sm">No pending routes.</p>
			)}

			{routes.map((route) => (
				<RouteRow key={route.id} route={route} />
			))}
		</div>
	);
};

export default RouteVerificationView;
