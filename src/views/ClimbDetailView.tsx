import { useNavigate, useParams } from "@tanstack/react-router";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { useClimb } from "@/features/climbs/climbs.queries";
import { useClimbsStore } from "@/features/climbs/climbs.store";
import { useRoute } from "@/features/routes/routes.queries";
import { cn } from "@/lib/cn";
import { buildLocationString } from "@/utils/build-location-string";

const ClimbDetailView = () => {
	const { climbId } = useParams({ from: "/climbs/$climbId" });
	const navigate = useNavigate();
	const { data: climb, isLoading } = useClimb(climbId);
	const { data: linkedRoute } = useRoute(climb?.route_id);
	const setSelectedClimbId = useClimbsStore((s) => s.setSelectedClimbId);
	const [movesOpen, setMovesOpen] = useState(false);

	useEffect(() => {
		setSelectedClimbId(climbId);
		return () => setSelectedClimbId(null);
	}, [climbId, setSelectedClimbId]);

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

	let moves: { id: string; text: string }[] = [];
	try {
		moves = JSON.parse(climb.moves);
	} catch {
		moves = [];
	}

	const location = buildLocationString([
		climb.country,
		climb.area,
		climb.sub_area,
	]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-start justify-between">
				<div>
					{climb.route_id ? (
						<button
							type="button"
							className="flex items-center gap-1.5 text-left"
							onClick={() =>
								navigate({
									to: "/routes/$routeId",
									params: { routeId: climb.route_id as string },
								})
							}
						>
							<h1 className="text-2xl font-bold">{climb.name}</h1>
							<ExternalLink
								size={16}
								className="text-text-secondary shrink-0 mt-1"
							/>
						</button>
					) : (
						<h1 className="text-2xl font-bold">{climb.name}</h1>
					)}
					{location && (
						<p className="text-sm text-text-secondary">{location}</p>
					)}
				</div>
				<div className="text-right flex flex-col items-end gap-0.5">
					<div className="flex items-baseline gap-1.5">
						<span className="text-xs text-text-secondary">Personal</span>
						<span className="text-lg font-semibold">{climb.grade}</span>
					</div>
					{linkedRoute && (
						<div className="flex items-baseline gap-1.5">
							<span className="text-xs text-text-secondary">Official</span>
							<span className="text-lg font-semibold">{linkedRoute.grade}</span>
						</div>
					)}
					<p className="text-xs text-text-secondary capitalize">
						{climb.route_type}
					</p>
				</div>
			</div>

			<div className="flex gap-2 flex-wrap">
				<span
					className={cn(
						"rounded-full px-3 py-1 text-sm capitalize",
						climb.sent_status === "sent" &&
							"bg-badge-sent-bg text-badge-sent-text",
						climb.sent_status === "todo" &&
							"bg-badge-todo-bg text-badge-todo-text",
						climb.sent_status !== "sent" &&
							climb.sent_status !== "todo" &&
							"bg-surface-card",
					)}
				>
					{climb.sent_status}
				</span>
			</div>

			<Button
				onClick={() =>
					navigate({
						to: "/climbs/$climbId/edit",
						params: { climbId: climb.id },
					})
				}
			>
				Edit
			</Button>

			{moves.length > 0 && (
				<div className="rounded-md bg-surface-card">
					<button
						type="button"
						className="flex items-center justify-between w-full p-3 text-sm text-text-secondary"
						onClick={() => setMovesOpen(!movesOpen)}
					>
						<span>Moves ({moves.length})</span>
						<ChevronDown
							size={16}
							className={cn("transition-transform", movesOpen && "rotate-180")}
						/>
					</button>
					{movesOpen && (
						<ul className="flex flex-col gap-1 px-3 pb-3">
							{moves.map((move, i) => (
								<li
									key={move.id}
									className="border-l border-text-primary pl-2 text-sm"
								>
									{i + 1}. {move.text}
								</li>
							))}
						</ul>
					)}
				</div>
			)}

			{climb.link && (
				<a
					href={climb.link}
					target="_blank"
					rel="noreferrer"
					className="text-emerald-400 text-sm underline"
				>
					{climb.link}
				</a>
			)}
		</div>
	);
};

export default ClimbDetailView;
