import { create } from "zustand";

interface ClimbsStore {
	selectedClimbId: string | null;
	setSelectedClimbId: (id: string | null) => void;

	// Filter state — persists across navigation
	searchText: string;
	setSearchText: (text: string) => void;
	filtersOpen: boolean;
	setFiltersOpen: (open: boolean) => void;
	statusFilters: Set<string>;
	toggleStatusFilter: (status: string) => void;
	typeFilters: Set<string>;
	toggleTypeFilter: (type: string) => void;
}

export const useClimbsStore = create<ClimbsStore>((set) => ({
	selectedClimbId: null,
	setSelectedClimbId: (id) => set({ selectedClimbId: id }),

	searchText: "",
	setSearchText: (searchText) => set({ searchText }),
	filtersOpen: false,
	setFiltersOpen: (filtersOpen) => set({ filtersOpen }),
	statusFilters: new Set(["sent", "project"]),
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
}));
