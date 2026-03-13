import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/atoms/Input";
import { Spinner } from "@/components/atoms/Spinner";
import { ClimbCard } from "@/components/molecules/ClimbCard";
import { FilterPanel } from "@/components/molecules/FilterPanel";
import { useClimbs, useDeleteClimb } from "@/features/climbs/climbs.queries";
import { useClimbsStore } from "@/features/climbs/climbs.store";

const HomeView = () => {
	const navigate = useNavigate();
	const { data: climbs = [], isLoading } = useClimbs();
	const { mutateAsync: deleteClimb } = useDeleteClimb();

	const searchText = useClimbsStore((s) => s.searchText);
	const setSearchText = useClimbsStore((s) => s.setSearchText);
	const statusFilters = useClimbsStore((s) => s.statusFilters);
	const typeFilters = useClimbsStore((s) => s.typeFilters);

	if (isLoading) {
		return (
			<div className="flex justify-center pt-12">
				<Spinner />
			</div>
		);
	}

	const query = searchText.toLowerCase();
	const filtered = climbs.filter((c) => {
		if (!statusFilters.has(c.sent_status)) return false;
		if (!typeFilters.has(c.route_type)) return false;
		if (query) {
			const haystack = [c.name, c.grade, c.country, c.area, c.sub_area]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			if (!haystack.includes(query)) return false;
		}
		return true;
	});

	return (
		<div className="flex flex-col gap-3">
			<Input
				placeholder="Search climbs…"
				value={searchText}
				onChange={(e) => setSearchText(e.target.value)}
			/>
			<FilterPanel climbs={climbs} />
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
					<p className="text-text-secondary text-center pt-12">
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
