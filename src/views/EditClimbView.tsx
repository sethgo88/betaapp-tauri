import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { ClimbForm } from "@/components/organisms/ClimbForm";
import {
	useClimb,
	useDeleteClimb,
	useUpdateClimb,
} from "@/features/climbs/climbs.queries";
import type { ClimbFormValues } from "@/features/climbs/climbs.schema";
import { useClimbsStore } from "@/features/climbs/climbs.store";
import { useUiStore } from "@/stores/ui.store";

const EditClimbView = () => {
	const { climbId } = useParams({ from: "/climbs/$climbId/edit" });
	const navigate = useNavigate();
	const { data: climb, isLoading } = useClimb(climbId);
	const { mutateAsync: updateClimb } = useUpdateClimb();
	const { mutate: deleteClimb } = useDeleteClimb();
	const addToast = useUiStore((s) => s.addToast);
	const setSelectedClimbId = useClimbsStore((s) => s.setSelectedClimbId);

	useEffect(() => {
		setSelectedClimbId(climbId);
		return () => setSelectedClimbId(null);
	}, [climbId, setSelectedClimbId]);

	const handleSubmit = async (values: ClimbFormValues) => {
		await updateClimb({ id: climbId, data: values });
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
		return <p className="text-stone-400 text-center pt-12">Climb not found.</p>;
	}

	return (
		<div className="flex flex-col gap-4">
			<ClimbForm
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
				}}
				onSubmit={handleSubmit}
			/>
			<Button variant="secondary" onClick={handleDelete}>
				Delete climb
			</Button>
		</div>
	);
};

export default EditClimbView;
