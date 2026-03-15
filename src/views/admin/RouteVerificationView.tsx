import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { useGrades } from "@/features/grades/grades.queries";
import {
	useAllRoutes,
	useMergeRoute,
	useRejectRoute,
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

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
	pending: "bg-amber-500/20 text-amber-400",
	verified: "bg-emerald-500/20 text-emerald-400",
	rejected: "bg-red-500/20 text-red-400",
};

const StatusBadge = ({ status }: { status: string }) => (
	<span
		className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[status] ?? "bg-surface-page text-text-secondary"}`}
	>
		{status}
	</span>
);

// ── Route row ─────────────────────────────────────────────────────────────────

const RouteRow = ({ route }: { route: UnverifiedRoute }) => {
	const addToast = useUiStore((s) => s.addToast);
	const [mode, setMode] = useState<"idle" | "edit" | "merge">("idle");

	const { mutate: verify } = useVerifyRoute();
	const { mutate: reject } = useRejectRoute();
	const { mutate: updateFields } = useUpdateRouteFields();
	const { mutate: merge } = useMergeRoute();

	const isPending = route.status === "pending";

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
				<div className="flex items-center gap-2">
					<StatusBadge status={route.status} />
					<span className="text-xs text-text-tertiary">
						{new Date(route.created_at).toLocaleDateString()}
					</span>
				</div>
			</div>

			{mode === "idle" && (
				<div className="flex gap-2 mt-2 flex-wrap">
					{isPending && (
						<Button
							type="button"
							variant="primary"
							size="small"
							onClick={handleVerify}
						>
							Approve
						</Button>
					)}
					<Button
						type="button"
						variant="secondary"
						size="small"
						onClick={() => setMode("edit")}
					>
						Edit
					</Button>
					{isPending && (
						<Button
							type="button"
							variant="secondary"
							size="small"
							onClick={() => setMode("merge")}
						>
							Merge
						</Button>
					)}
					{isPending && (
						<Button
							type="button"
							variant="secondary"
							size="small"
							onClick={handleReject}
						>
							Reject
						</Button>
					)}
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
	const { data: routes = [], isLoading } = useAllRoutes();

	return (
		<div className="flex flex-col gap-4">
			<button
				type="button"
				className="text-text-secondary text-sm text-left"
				onClick={() => router.history.back()}
			>
				← Back
			</button>

			<h1 className="text-lg font-display font-semibold">Route Manager</h1>

			{isLoading && <p className="text-text-secondary text-sm">Loading…</p>}

			{!isLoading && routes.length === 0 && (
				<p className="text-text-secondary text-sm">No routes yet.</p>
			)}

			{routes.map((route) => (
				<RouteRow key={route.id} route={route} />
			))}
		</div>
	);
};

export default RouteVerificationView;
