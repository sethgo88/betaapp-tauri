import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Climb } from "@/features/climbs/climbs.schema";
import type { SortKey } from "@/features/climbs/climbs.store";
import { useClimbsStore } from "@/features/climbs/climbs.store";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/stores/ui.store";

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
			className="accent-accent-primary w-4 h-4"
		/>
		<span>
			{label} ({count})
		</span>
	</label>
);

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
	{ key: "name_asc", label: "A → Z (title)" },
	{ key: "name_desc", label: "Z → A (title)" },
	{ key: "date_desc", label: "Newest first" },
	{ key: "date_asc", label: "Oldest first" },
	{ key: "grade_asc", label: "Grade easy → hard" },
	{ key: "grade_desc", label: "Grade hard → easy" },
];

export const FilterPanel = ({ climbs }: FilterPanelProps) => {
	const filtersOpen = useClimbsStore((s) => s.filtersOpen);
	const setFiltersOpen = useClimbsStore((s) => s.setFiltersOpen);
	const statusFilters = useClimbsStore((s) => s.statusFilters);
	const toggleStatusFilter = useClimbsStore((s) => s.toggleStatusFilter);
	const typeFilters = useClimbsStore((s) => s.typeFilters);
	const toggleTypeFilter = useClimbsStore((s) => s.toggleTypeFilter);
	const sortKey = useClimbsStore((s) => s.sortKey);
	const setSortKey = useClimbsStore((s) => s.setSortKey);
	const defaultStatusFilters = useUiStore((s) => s.defaultStatusFilters);

	const wrapperRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!filtersOpen) return;
		const handleClick = (e: MouseEvent) => {
			if (!wrapperRef.current?.contains(e.target as Node)) {
				setFiltersOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [filtersOpen, setFiltersOpen]);

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

	const isNonDefault =
		statusFilters.size !== defaultStatusFilters.size ||
		[...defaultStatusFilters].some((s) => !statusFilters.has(s)) ||
		typeFilters.size !== 2 ||
		sortKey !== "name_asc";

	return (
		<div className="relative" ref={wrapperRef}>
			<button
				type="button"
				className="flex items-center gap-1.5 text-sm text-white"
				onClick={() => setFiltersOpen(!filtersOpen)}
			>
				<span>Filter / Sort</span>
				{isNonDefault && (
					<span className="w-2 h-2 rounded-full bg-accent-primary" />
				)}
				<ChevronDown
					size={16}
					className={cn("transition-transform", filtersOpen && "rotate-180")}
				/>
			</button>

			{filtersOpen && (
				<div className="absolute top-full left-0 mt-1 z-10 w-64 flex flex-col gap-3 rounded-[var(--radius-lg)] bg-surface-card border border-card-border p-3 shadow-card">
					<div>
						<p className="text-xs text-text-on-light uppercase tracking-wide mb-1">
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
						<p className="text-xs text-text-on-light uppercase tracking-wide mb-1">
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
					<div>
						<p className="text-xs text-text-on-light uppercase tracking-wide mb-1">
							Sort
						</p>
						<div className="flex flex-col gap-1">
							{SORT_OPTIONS.map((opt) => (
								<label
									key={opt.key}
									className="flex items-center gap-2 text-sm cursor-pointer"
								>
									<input
										type="radio"
										name="sort"
										value={opt.key}
										checked={sortKey === opt.key}
										onChange={() => setSortKey(opt.key)}
										className="accent-accent-primary w-4 h-4"
									/>
									<span>{opt.label}</span>
								</label>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
