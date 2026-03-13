import { useNavigate, useParams } from "@tanstack/react-router";
import { Spinner } from "@/components/atoms/Spinner";
import { EditableDescription } from "@/components/molecules/EditableDescription";
import { useAuthStore } from "@/features/auth/auth.store";
import {
	useCrags,
	useSubRegion,
	useUpdateLocationDescription,
} from "@/features/locations/locations.queries";

const SubRegionView = () => {
	const { subRegionId } = useParams({ from: "/sub-regions/$subRegionId" });
	const navigate = useNavigate();
	const { data: subRegion, isLoading } = useSubRegion(subRegionId);
	const { data: crags = [] } = useCrags(subRegionId);
	const updateDescription = useUpdateLocationDescription();
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	if (!subRegion) {
		return <p className="text-text-secondary text-center pt-12">Not found</p>;
	}

	return (
		<div className="flex flex-col gap-3">
			<button
				type="button"
				className="text-text-secondary text-sm text-left"
				onClick={() =>
					navigate({
						to: "/regions/$regionId",
						params: { regionId: subRegion.region_id },
					})
				}
			>
				← Back to region
			</button>

			<h1 className="text-xl font-display font-bold">{subRegion.name}</h1>

			<EditableDescription
				description={subRegion.description}
				isAdmin={isAdmin}
				onSave={async (description) => {
					await updateDescription.mutateAsync({
						table: "sub_regions",
						id: subRegionId,
						description,
					});
				}}
			/>

			{crags.length === 0 && (
				<p className="text-text-secondary text-sm">
					No crags in this area yet.
				</p>
			)}

			{crags.map((crag) => (
				<button
					key={crag.id}
					type="button"
					className="rounded-lg bg-surface-card p-4 text-left flex items-center justify-between"
					onClick={() =>
						crag.status === "pending"
							? undefined
							: navigate({
									to: "/crags/$cragId",
									params: { cragId: crag.id },
								})
					}
				>
					<span className="font-medium">{crag.name}</span>
					<div className="flex items-center gap-2">
						{crag.status === "pending" && (
							<span className="text-xs text-amber-400">pending</span>
						)}
					</div>
				</button>
			))}
		</div>
	);
};

export default SubRegionView;
