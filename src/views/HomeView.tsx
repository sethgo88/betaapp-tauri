import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import { ClimbCard } from "@/components/molecules/ClimbCard";
import { useClimbs, useDeleteClimb } from "@/features/climbs/climbs.queries";
import { cn } from "@/lib/cn";

const HomeView = () => {
	const navigate = useNavigate();
	const { data: climbs = [], isLoading } = useClimbs();
	const { mutateAsync: deleteClimb } = useDeleteClimb();
	const [showTodo, setShowTodo] = useState(false);

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	const filtered = showTodo
		? climbs
		: climbs.filter((c) => c.sent_status !== "todo");

	const todoCount = climbs.filter((c) => c.sent_status === "todo").length;

	return (
		<div className="flex flex-col gap-3">
			{todoCount > 0 && (
				<button
					type="button"
					className={cn(
						"text-sm text-stone-400 text-left",
						showTodo && "text-amber-400",
					)}
					onClick={() => setShowTodo((v) => !v)}
				>
					{showTodo ? "Hide" : "Show"} todo ({todoCount})
				</button>
			)}
			<ul className="flex flex-col gap-3">
				{filtered.map((climb) => (
					<ClimbCard
						key={climb.id}
						climb={climb}
						onClick={() =>
							navigate({
								to: "/climbs/$climbId",
								params: { climbId: climb.id },
							})
						}
						onDelete={deleteClimb}
					/>
				))}
				{filtered.length === 0 && (
					<p className="text-stone-400 text-center pt-12">
						{climbs.length === 0
							? "No climbs yet. Add your first!"
							: "No matching climbs."}
					</p>
				)}
			</ul>
		</div>
	);
};

export default HomeView;
