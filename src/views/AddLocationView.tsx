import { LocationDrillDown } from "@/components/molecules/LocationDrillDown";
import { useAuthStore } from "@/features/auth/auth.store";

// This view only uses LocationDrillDown for its allowAdd behaviour;
// the selection value itself is not needed here.
const noop = () => {};

const AddLocationView = () => {
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-lg font-display font-semibold">Add Location</h1>

			<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-3">
				<LocationDrillDown onChange={noop} stopAt="wall" allowAdd={isAdmin} />
			</div>
		</div>
	);
};

export default AddLocationView;
