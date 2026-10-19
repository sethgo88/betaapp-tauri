import { create } from "zustand";
import type { ScopeType } from "./image-downloads.schema";

export type ActiveDownload = {
	type: ScopeType;
	id: string;
	done: number;
	total: number;
	/** True while region data is being fetched, before image progress starts */
	preparing: boolean;
	controller: AbortController;
};

interface ImageDownloadStore {
	/** One download runs at a time; it survives navigation between views. */
	active: ActiveDownload | null;
	begin: (type: ScopeType, id: string) => AbortController;
	setProgress: (done: number, total: number) => void;
	finish: () => void;
	/** Session-only: hides the "image updates available" banner until next launch. */
	updatesBannerDismissed: boolean;
	dismissUpdatesBanner: () => void;
}

export const useImageDownloadStore = create<ImageDownloadStore>((set) => ({
	active: null,
	begin: (type, id) => {
		const controller = new AbortController();
		set({
			active: { type, id, done: 0, total: 0, preparing: true, controller },
		});
		return controller;
	},
	setProgress: (done, total) =>
		set((s) =>
			s.active ? { active: { ...s.active, done, total, preparing: false } } : s,
		),
	finish: () => set({ active: null }),
	updatesBannerDismissed: false,
	dismissUpdatesBanner: () => set({ updatesBannerDismissed: true }),
}));
