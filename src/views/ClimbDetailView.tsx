import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { useClimb } from "@/features/climbs/climbs.queries";
import { useClimbsStore } from "@/features/climbs/climbs.store";
import { buildLocationString } from "@/utils/build-location-string";

const ClimbDetailView = () => {
	const { climbId } = useParams({ from: "/climbs/$climbId" });
	const navigate = useNavigate();
	const { data: climb, isLoading } = useClimb(climbId);
	const setSelectedClimbId = useClimbsStore((s) => s.setSelectedClimbId);

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
		return <p className="text-stone-400 text-center pt-12">Climb not found.</p>;
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
					<h1 className="text-2xl font-bold">{climb.name}</h1>
					{location && <p className="text-sm text-stone-400">{location}</p>}
				</div>
				<div className="text-right">
					<span className="text-lg font-semibold">{climb.grade}</span>
					<p className="text-xs text-stone-400 capitalize">
						{climb.route_type}
					</p>
				</div>
			</div>

			<div className="flex gap-2">
				<span className="bg-stone-800 rounded-full px-3 py-1 text-sm capitalize">
					{climb.sent_status}
				</span>
			</div>

			{moves.length > 0 && (
				<div className="rounded-md bg-stone-800 p-3">
					<ul className="flex flex-col gap-1">
						{moves.map((move, i) => (
							<li key={move.id} className="border-l border-white pl-2 text-sm">
								{i + 1}. {move.text}
							</li>
						))}
					</ul>
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
		</div>
	);
};

export default ClimbDetailView;
