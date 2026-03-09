import { useNavigate, useRouterState } from "@tanstack/react-router";
import { CircleUser, Home, PlusSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useDeleteClimb } from "@/features/climbs/climbs.queries";
import { useClimbsStore } from "@/features/climbs/climbs.store";

export const NavBar = () => {
	const { location } = useRouterState();
	const navigate = useNavigate();
	const pathname = location.pathname;

	const isEdit = pathname.endsWith("/edit");

	const selectedClimbId = useClimbsStore((s) => s.selectedClimbId);
	const setSelectedClimbId = useClimbsStore((s) => s.setSelectedClimbId);
	const { mutate: deleteClimb } = useDeleteClimb();

	const handleDelete = () => {
		if (!selectedClimbId) return;
		deleteClimb(selectedClimbId, {
			onSuccess: () => {
				setSelectedClimbId(null);
				navigate({ to: "/" });
			},
		});
	};

	return (
		<div className="w-full flex justify-around bg-stone-900 fixed bottom-0 px-[3vw] text-white h-[7vh] items-center">
			<Button
				variant="unstyled"
				type="button"
				className="w-full text-center"
				onClick={() => navigate({ to: "/" })}
			>
				<Home className="mx-auto" size={22} />
			</Button>

			<Button
				variant="unstyled"
				type="button"
				className="w-full text-center"
				onClick={() => navigate({ to: "/climbs/add" })}
			>
				<PlusSquare className="mx-auto" size={22} />
			</Button>

			{isEdit && (
				<Button
					variant="unstyled"
					type="button"
					className="w-full text-center"
					onClick={handleDelete}
				>
					<Trash2 className="mx-auto" size={22} />
				</Button>
			)}

			<Button
				variant="unstyled"
				type="button"
				className="w-full text-center flex flex-col items-center gap-0.5"
				onClick={() => navigate({ to: "/profile" })}
			>
				<CircleUser size={22} />
			</Button>
		</div>
	);
};
