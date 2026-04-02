import { create } from "zustand";

const storedDefaultStatusFilters: Set<string> = (() => {
	try {
		const raw = localStorage.getItem("betaapp-default-status-filters");
		if (!raw) return new Set(["project"]);
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return new Set(parsed);
		return new Set(["project"]);
	} catch {
		return new Set(["project"]);
	}
})();

export type SortKey =
	| "name_asc"
	| "name_desc"
	| "date_desc"
	| "date_asc"
	| "grade_asc"
	| "grade_desc";

interface ClimbsStore {
	selectedClimbId: string | null;
	setSelectedClimbId: (id: string | null) => void;

	// Filter / sort state — persists across navigation
	searchText: string;
	setSearchText: (text: string) => void;
	filtersOpen: boolean;
	setFiltersOpen: (open: boolean) => void;
	statusFilters: Set<string>;
	toggleStatusFilter: (status: string) => void;
	typeFilters: Set<string>;
	toggleTypeFilter: (type: string) => void;
	sortKey: SortKey;
	setSortKey: (key: SortKey) => void;
}

export const useClimbsStore = create<ClimbsStore>((set) => ({
	selectedClimbId: null,
	setSelectedClimbId: (id) => set({ selectedClimbId: id }),

	searchText: "",
	setSearchText: (searchText) => set({ searchText }),
	filtersOpen: false,
	setFiltersOpen: (filtersOpen) => set({ filtersOpen }),
	statusFilters: storedDefaultStatusFilters,
	toggleStatusFilter: (status) =>
		set((state) => {
			const next = new Set(state.statusFilters);
			if (next.has(status)) next.delete(status);
			else next.add(status);
			return { statusFilters: next };
		}),
	typeFilters: new Set(["sport", "boulder"]),
	toggleTypeFilter: (type) =>
		set((state) => {
			const next = new Set(state.typeFilters);
			if (next.has(type)) next.delete(type);
			else next.add(type);
			return { typeFilters: next };
		}),
	sortKey: "name_asc",
	setSortKey: (sortKey) => set({ sortKey }),
}));
