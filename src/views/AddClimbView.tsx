import { useNavigate } from "@tanstack/react-router";
import { ClimbForm } from "@/components/organisms/ClimbForm";
import { useAddClimb } from "@/features/climbs/climbs.queries";
import type { ClimbFormValues } from "@/features/climbs/climbs.schema";
import { useUiStore } from "@/stores/ui.store";

const AddClimbView = () => {
	const navigate = useNavigate();
	const { mutateAsync: addClimb } = useAddClimb();
	const addToast = useUiStore((s) => s.addToast);

	const handleSubmit = async (values: ClimbFormValues) => {
		await addClimb(values);
		addToast({ message: "Climb added", type: "success" });
		navigate({ to: "/" });
	};

	return <ClimbForm onSubmit={handleSubmit} />;
};

export default AddClimbView;
