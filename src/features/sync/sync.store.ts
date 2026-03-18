import { create } from "zustand";

type SyncStatus = "idle" | "syncing" | "error" | "offline";

interface SyncStore {
	status: SyncStatus;
	lastSyncedAt: string | null;
	error: string | null;
	triggerSync: (() => void) | null;
	setSyncing: () => void;
	setSuccess: () => void;
	setError: (error: string) => void;
	setOffline: () => void;
	setTriggerSync: (fn: () => void) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
	status: "idle",
	lastSyncedAt: null,
	error: null,
	triggerSync: null,
	setSyncing: () => set({ status: "syncing", error: null }),
	setSuccess: () =>
		set({ status: "idle", lastSyncedAt: new Date().toISOString() }),
	setError: (error) => set({ status: "error", error }),
	setOffline: () => set({ status: "offline", error: null }),
	setTriggerSync: (fn) => set({ triggerSync: fn }),
}));
