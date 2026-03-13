import { ChevronDown } from "lucide-react";
import type { Climb } from "@/features/climbs/climbs.schema";
import { useClimbsStore } from "@/features/climbs/climbs.store";
import { cn } from "@/lib/cn";

interface FilterPanelProps {
	climbs: Climb[];
}

const FilterCheckbox = ({
	label,
	count,
	checked,
	onChange,
}: {
	label: string;
	count: number;
	checked: boolean;
	onChange: () => void;
}) => (
	<label className="flex items-center gap-2 text-sm cursor-pointer">
		<input
			type="checkbox"
			checked={checked}
			onChange={onChange}
			className="accent-emerald-500 w-4 h-4"
		/>
		<span>
			{label} ({count})
		</span>
	</label>
);

export const FilterPanel = ({ climbs }: FilterPanelProps) => {
	const filtersOpen = useClimbsStore((s) => s.filtersOpen);
	const setFiltersOpen = useClimbsStore((s) => s.setFiltersOpen);
	const statusFilters = useClimbsStore((s) => s.statusFilters);
	const toggleStatusFilter = useClimbsStore((s) => s.toggleStatusFilter);
	const typeFilters = useClimbsStore((s) => s.typeFilters);
	const toggleTypeFilter = useClimbsStore((s) => s.toggleTypeFilter);

	// Status counts are filtered by active type filters
	const typeFiltered = climbs.filter((c) => typeFilters.has(c.route_type));
	const statusCounts = {
		todo: typeFiltered.filter((c) => c.sent_status === "todo").length,
		project: typeFiltered.filter((c) => c.sent_status === "project").length,
		sent: typeFiltered.filter((c) => c.sent_status === "sent").length,
	};
	// Type counts are filtered by active status filters
	const statusFiltered = climbs.filter((c) => statusFilters.has(c.sent_status));
	const typeCounts = {
		sport: statusFiltered.filter((c) => c.route_type === "sport").length,
		boulder: statusFiltered.filter((c) => c.route_type === "boulder").length,
	};

	return (
		<div>
			<button
				type="button"
				className="flex items-center gap-1 text-sm text-text-secondary w-full"
				onClick={() => setFiltersOpen(!filtersOpen)}
			>
				<span>Filters</span>
				<ChevronDown
					size={16}
					className={cn("transition-transform", filtersOpen && "rotate-180")}
				/>
			</button>

			{filtersOpen && (
				<div className="mt-2 flex flex-col gap-3 rounded-lg bg-surface-card p-3">
					<div>
						<p className="text-xs text-text-secondary uppercase tracking-wide mb-1">
							Status
						</p>
						<div className="flex flex-wrap gap-x-4 gap-y-1">
							<FilterCheckbox
								label="Sent"
								count={statusCounts.sent}
								checked={statusFilters.has("sent")}
								onChange={() => toggleStatusFilter("sent")}
							/>
							<FilterCheckbox
								label="Project"
								count={statusCounts.project}
								checked={statusFilters.has("project")}
								onChange={() => toggleStatusFilter("project")}
							/>
							<FilterCheckbox
								label="Todo"
								count={statusCounts.todo}
								checked={statusFilters.has("todo")}
								onChange={() => toggleStatusFilter("todo")}
							/>
						</div>
					</div>
					<div>
						<p className="text-xs text-text-secondary uppercase tracking-wide mb-1">
							Type
						</p>
						<div className="flex flex-wrap gap-x-4 gap-y-1">
							<FilterCheckbox
								label="Sport"
								count={typeCounts.sport}
								checked={typeFilters.has("sport")}
								onChange={() => toggleTypeFilter("sport")}
							/>
							<FilterCheckbox
								label="Boulder"
								count={typeCounts.boulder}
								checked={typeFilters.has("boulder")}
								onChange={() => toggleTypeFilter("boulder")}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
