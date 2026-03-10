import { useNavigate, useSearch } from "@tanstack/react-router";
import { ClimbForm } from "@/components/organisms/ClimbForm";
import { useAddClimb } from "@/features/climbs/climbs.queries";
import type { ClimbFormValues } from "@/features/climbs/climbs.schema";
import { useUiStore } from "@/stores/ui.store";

const AddClimbView = () => {
	const navigate = useNavigate();
	const { mutateAsync: addClimb } = useAddClimb();
	const addToast = useUiStore((s) => s.addToast);
	const { routeId, routeName, grade, routeType } = useSearch({
		from: "/climbs/add",
	});

	const handleSubmit = async (values: ClimbFormValues) => {
		await addClimb({ data: values, routeId });
		addToast({ message: "Climb added", type: "success" });
		navigate({ to: "/" });
	};

	return (
		<ClimbForm
			defaultValues={{
				name: routeName ?? "",
				grade: grade ?? "",
				route_type: routeType ?? "sport",
			}}
			onSubmit={handleSubmit}
		/>
	);
};

export default AddClimbView;
