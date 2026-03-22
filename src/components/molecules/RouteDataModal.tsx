import { RouteBodyChart } from "@/components/molecules/RouteBodyChart";
import { Sheet } from "@/components/molecules/Sheet";

interface RouteDataModalProps {
	isOpen: boolean;
	onClose: () => void;
	routeId: string;
	routeName: string;
	routeType: "sport" | "boulder";
}

export function RouteDataModal({
	isOpen,
	onClose,
	routeId,
	routeName,
	routeType,
}: RouteDataModalProps) {
	return (
		<Sheet isOpen={isOpen} onClose={onClose} title={routeName}>
			<RouteBodyChart routeId={routeId} routeType={routeType} />
		</Sheet>
	);
}
