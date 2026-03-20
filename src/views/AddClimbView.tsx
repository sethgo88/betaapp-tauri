import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { RoutePickerSheet } from "@/components/molecules/RoutePickerSheet";
import { ClimbForm } from "@/components/organisms/ClimbForm";
import { useAddClimb } from "@/features/climbs/climbs.queries";
import type { ClimbFormValues } from "@/features/climbs/climbs.schema";
import type { Route } from "@/features/routes/routes.schema";
import { useUiStore } from "@/stores/ui.store";

const AddClimbView = () => {
	const navigate = useNavigate();
	const { mutateAsync: addClimb } = useAddClimb();
	const addToast = useUiStore((s) => s.addToast);
	const { routeId, routeName, grade, routeType } = useSearch({
		from: "/climbs/add",
	});

	const [pickerOpen, setPickerOpen] = useState(false);
	const [linkedRoute, setLinkedRoute] = useState<{
		id: string;
		name: string;
		grade: string;
	} | null>(
		routeId && routeName
			? { id: routeId, name: routeName, grade: grade ?? "" }
			: null,
	);

	const handleRouteSelect = (route: Route) => {
		setLinkedRoute({ id: route.id, name: route.name, grade: route.grade });
	};

	const handleSubmit = async (values: ClimbFormValues) => {
		await addClimb({ data: values, routeId: linkedRoute?.id });
		addToast({ message: "Climb added", type: "success" });
		navigate({ to: "/" });
	};

	return (
		<>
			<ClimbForm
				defaultValues={{
					name: routeName ?? "",
					grade: grade ?? "",
					route_type: routeType ?? "sport",
				}}
				onSubmit={handleSubmit}
				linkedRoute={linkedRoute}
				onOpenRoutePicker={() => setPickerOpen(true)}
				onUnlinkRoute={() => setLinkedRoute(null)}
			/>

			<RoutePickerSheet
				isOpen={pickerOpen}
				onClose={() => setPickerOpen(false)}
				onSelect={handleRouteSelect}
			/>
		</>
	);
};

export default AddClimbView;
