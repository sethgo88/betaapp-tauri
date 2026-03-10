import { useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import {
	useSubmitWall,
	useWalls,
} from "@/features/locations/locations.queries";
import { useRoutes } from "@/features/routes/routes.queries";

// ── Inline name form ──────────────────────────────────────────────────────────

const InlineAddForm = ({
	placeholder,
	pending,
	onSubmit,
	onCancel,
}: {
	placeholder: string;
	pending: boolean;
	onSubmit: (name: string) => void;
	onCancel: () => void;
}) => {
	const [name, setName] = useState("");

	return (
		<div className="flex gap-2 mt-2">
			<input
				type="text"
				value={name}
				onChange={(e) => setName(e.target.value)}
				placeholder={placeholder}
				className="flex-1 text-sm bg-stone-700 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-500 outline-none"
				// biome-ignore lint/a11y/noAutofocus: intentional — form appears on user tap
				autoFocus
			/>
			<button
				type="button"
				disabled={!name.trim() || pending}
				onClick={() => onSubmit(name.trim())}
				className="text-sm px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40"
			>
				{pending ? "…" : "Add"}
			</button>
			<button
				type="button"
				onClick={onCancel}
				className="text-sm px-3 py-2 rounded-lg bg-stone-600 hover:bg-stone-500"
			>
				Cancel
			</button>
		</div>
	);
};

// ── Route list ────────────────────────────────────────────────────────────────

const RouteList = ({ wallId }: { wallId: string }) => {
	const navigate = useNavigate();
	const { data: routes = [] } = useRoutes(wallId);

	if (routes.length === 0) {
		return <p className="text-sm text-stone-500 px-2 py-1">No routes yet</p>;
	}

	return (
		<div className="flex flex-col gap-1 mt-2">
			{routes.map((route) => (
				<button
					key={route.id}
					type="button"
					disabled={route.status === "pending"}
					onClick={() =>
						navigate({
							to: "/climbs/add",
							search: {
								routeId: route.id,
								routeName: route.name,
								grade: route.grade,
								routeType: route.route_type as "sport" | "boulder",
							},
						})
					}
					className="flex items-center justify-between py-2 px-2 rounded-lg bg-stone-700 hover:bg-stone-600 disabled:opacity-60 w-full text-left"
				>
					<span className="text-sm">{route.name}</span>
					<div className="flex items-center gap-2">
						<span className="text-xs text-stone-400">{route.grade}</span>
						<span className="text-xs text-stone-500">{route.route_type}</span>
						{route.status === "pending" && (
							<span className="text-xs text-amber-400">pending</span>
						)}
					</div>
				</button>
			))}
		</div>
	);
};

// ── Crag view ─────────────────────────────────────────────────────────────────

const CragView = () => {
	const { cragId } = useParams({ from: "/crags/$cragId" });
	const router = useRouter();
	const navigate = useNavigate();
	const { data: walls = [] } = useWalls(cragId);
	const submitWall = useSubmitWall();
	const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
	const [showWallForm, setShowWallForm] = useState(false);

	const handleAddWall = async (name: string) => {
		await submitWall.mutateAsync({ crag_id: cragId, name });
		setShowWallForm(false);
	};

	return (
		<div className="flex flex-col gap-3">
			<button
				type="button"
				className="text-stone-400 text-sm text-left"
				onClick={() => router.history.back()}
			>
				← Back
			</button>

			{walls.length === 0 && !showWallForm && (
				<p className="text-stone-400 text-sm">No walls in this crag yet.</p>
			)}

			{walls.map((wall) => (
				<div key={wall.id} className="rounded-lg bg-stone-800 p-4">
					<button
						type="button"
						className="w-full text-left font-medium flex items-center justify-between"
						onClick={() =>
							setSelectedWallId(selectedWallId === wall.id ? null : wall.id)
						}
					>
						<span>{wall.name}</span>
						{wall.status === "pending" && (
							<span className="text-xs text-amber-400">pending</span>
						)}
					</button>

					{selectedWallId === wall.id && (
						<>
							<RouteList wallId={wall.id} />
							<Button
								type="button"
								variant="secondary"
								size="small"
								className="mt-3"
								onClick={() =>
									navigate({
										to: "/routes/submit",
										search: { wallId: wall.id, wallName: wall.name },
									})
								}
							>
								Submit a route
							</Button>
						</>
					)}
				</div>
			))}

			{showWallForm ? (
				<InlineAddForm
					placeholder="Wall name"
					pending={submitWall.isPending}
					onSubmit={handleAddWall}
					onCancel={() => setShowWallForm(false)}
				/>
			) : (
				<button
					type="button"
					onClick={() => setShowWallForm(true)}
					className="text-sm text-stone-400 hover:text-stone-200 text-left"
				>
					+ Add wall
				</button>
			)}
		</div>
	);
};

export default CragView;
