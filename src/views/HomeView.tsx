import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import { ClimbCard } from "@/components/molecules/ClimbCard";
import { useAuthStore } from "@/features/auth/auth.store";
import { useClimbs, useDeleteClimb } from "@/features/climbs/climbs.queries";

const HomeView = () => {
	const navigate = useNavigate();
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const { data: climbs = [], isLoading } = useClimbs();
	const { mutateAsync: deleteClimb } = useDeleteClimb();

	useEffect(() => {
		if (!isAuthenticated) navigate({ to: "/profile" });
	}, [isAuthenticated, navigate]);

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	return (
		<ul className="flex flex-col gap-3">
			{climbs.map((climb) => (
				<ClimbCard
					key={climb.id}
					climb={climb}
					onClick={() =>
						navigate({ to: "/climbs/$climbId", params: { climbId: climb.id } })
					}
					onDelete={deleteClimb}
				/>
			))}
			{climbs.length === 0 && (
				<p className="text-stone-400 text-center pt-12">
					No climbs yet. Add your first!
				</p>
			)}
		</ul>
	);
};

export default HomeView;
