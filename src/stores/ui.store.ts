import { create } from "zustand";

export type Toast = {
	id: string;
	message: string;
	type: "success" | "error" | "warning";
};

interface UiStore {
	toasts: Toast[];
	addToast: (toast: Omit<Toast, "id">) => void;
	removeToast: (id: string) => void;
}

export const useUiStore = create<UiStore>((set) => ({
	toasts: [],
	addToast: (toast) =>
		set((s) => ({
			toasts: [...s.toasts, { ...toast, id: crypto.randomUUID() }],
		})),
	removeToast: (id) =>
		set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
