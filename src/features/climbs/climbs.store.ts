import { create } from "zustand";

interface ClimbsStore {
	selectedClimbId: string | null;
	setSelectedClimbId: (id: string | null) => void;
}

export const useClimbsStore = create<ClimbsStore>((set) => ({
	selectedClimbId: null,
	setSelectedClimbId: (id) => set({ selectedClimbId: id }),
}));
