import { create } from "zustand";

type SyncStatus = "idle" | "syncing" | "error";

interface SyncStore {
	status: SyncStatus;
	lastSyncedAt: string | null;
	error: string | null;
	setSyncing: () => void;
	setSuccess: () => void;
	setError: (error: string) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
	status: "idle",
	lastSyncedAt: null,
	error: null,
	setSyncing: () => set({ status: "syncing", error: null }),
	setSuccess: () =>
		set({ status: "idle", lastSyncedAt: new Date().toISOString() }),
	setError: (error) => set({ status: "error", error }),
}));
