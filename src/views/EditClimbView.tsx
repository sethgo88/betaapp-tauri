import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { ConfirmDeleteDialog } from "@/components/molecules/ConfirmDeleteDialog";
import { ClimbForm } from "@/components/organisms/ClimbForm";
import {
	useClimb,
	useDeleteClimb,
	useLinkClimbToRoute,
	useUpdateClimb,
} from "@/features/climbs/climbs.queries";
import type { ClimbFormValues } from "@/features/climbs/climbs.schema";
import { useClimbsStore } from "@/features/climbs/climbs.store";
import type { VerifiedRouteResult } from "@/features/routes/routes.service";
import { searchVerifiedRoutes } from "@/features/routes/routes.service";
import { useUiStore } from "@/stores/ui.store";

// ── Link to route section ─────────────────────────────────────────────────────

const LinkRouteSection = ({ climbId }: { climbId: string }) => {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<VerifiedRouteResult[]>([]);
	const [searching, setSearching] = useState(false);
	const link = useLinkClimbToRoute();
	const addToast = useUiStore((s) => s.addToast);

	const handleSearch = async () => {
		if (!query.trim()) return;
		setSearching(true);
		try {
			const data = await searchVerifiedRoutes(query.trim());
			setResults(data);
		} finally {
			setSearching(false);
		}
	};

	const handleLink = async (routeId: string) => {
		await link.mutateAsync({ climbId, routeId });
		addToast({ message: "Route linked", type: "success" });
	};

	return (
		<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-3">
			<p className="text-sm font-medium text-text-secondary">Link to a route</p>
			<div className="flex gap-2">
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleSearch()}
					placeholder="Search route name…"
					className="flex-1 text-sm bg-surface-page rounded-lg px-3 py-2 text-text-primary placeholder-text-tertiary outline-none"
				/>
				<button
					type="button"
					disabled={!query.trim() || searching}
					onClick={handleSearch}
					className="text-sm px-3 py-2 rounded-lg bg-surface-active hover:bg-surface-hover disabled:opacity-40"
				>
					{searching ? "…" : "Search"}
				</button>
			</div>

			{results.length > 0 && (
				<div className="flex flex-col gap-1">
					{results.map((r) => (
						<button
							key={r.id}
							type="button"
							onClick={() => handleLink(r.id)}
							className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-page hover:bg-surface-hover text-left w-full"
						>
							<div>
								<p className="text-sm">{r.name}</p>
								{r.walls && (
									<p className="text-xs text-text-secondary">{r.walls.name}</p>
								)}
							</div>
							<span className="text-xs text-text-secondary ml-2">
								{r.grade}
							</span>
						</button>
					))}
				</div>
			)}

			{results.length === 0 && query && !searching && (
				<p className="text-xs text-text-tertiary">
					No results. Try another name.
				</p>
			)}
		</div>
	);
};

// ── Edit climb view ───────────────────────────────────────────────────────────

const EditClimbView = () => {
	const { climbId } = useParams({ from: "/climbs/$climbId" });
	const navigate = useNavigate();
	const { data: climb, isLoading } = useClimb(climbId);
	const { mutateAsync: updateClimb } = useUpdateClimb();
	const { mutate: deleteClimb } = useDeleteClimb();
	const addToast = useUiStore((s) => s.addToast);
	const setSelectedClimbId = useClimbsStore((s) => s.setSelectedClimbId);
	const [confirmDelete, setConfirmDelete] = useState(false);

	useEffect(() => {
		setSelectedClimbId(climbId);
		return () => setSelectedClimbId(null);
	}, [climbId, setSelectedClimbId]);

	const handleSubmit = async (values: ClimbFormValues) => {
		await updateClimb({ id: climbId, data: values, routeId: climb?.route_id });
		addToast({ message: "Climb updated", type: "success" });
		navigate({ to: "/climbs/$climbId", params: { climbId } });
	};

	const handleDelete = () => {
		deleteClimb(climbId, {
			onSuccess: () => {
				setSelectedClimbId(null);
				navigate({ to: "/" });
			},
		});
	};

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	if (!climb) {
		return (
			<p className="text-text-secondary text-center pt-12">Climb not found.</p>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<ClimbForm
				climbId={climbId}
				defaultValues={{
					name: climb.name,
					route_type: climb.route_type as "sport" | "boulder",
					grade: climb.grade,
					moves: climb.moves,
					sent_status: climb.sent_status as
						| "project"
						| "sent"
						| "redpoint"
						| "flash"
						| "onsight",
					country: climb.country,
					area: climb.area,
					sub_area: climb.sub_area,
					route_location: climb.route_location,
					link: climb.link,
					rating: climb.rating,
				}}
				onSubmit={handleSubmit}
			/>

			{!climb.route_id && <LinkRouteSection climbId={climbId} />}

			<Button variant="secondary" onClick={() => setConfirmDelete(true)}>
				Delete climb
			</Button>
			<ConfirmDeleteDialog
				isOpen={confirmDelete}
				title="Delete climb"
				message={`Are you sure you want to delete "${climb.name}"? This can't be undone.`}
				onConfirm={() => {
					handleDelete();
					setConfirmDelete(false);
				}}
				onCancel={() => setConfirmDelete(false)}
			/>
		</div>
	);
};

export default EditClimbView;
