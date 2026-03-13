import { create } from "zustand";

export type Theme = "dark" | "light";

export type Toast = {
	id: string;
	message: string;
	type: "success" | "error" | "warning";
};

interface UiStore {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	toasts: Toast[];
	addToast: (toast: Omit<Toast, "id">) => void;
	removeToast: (id: string) => void;
}

const storedTheme =
	(localStorage.getItem("betaapp-theme") as Theme | null) ?? "dark";

export const useUiStore = create<UiStore>((set) => ({
	theme: storedTheme,
	setTheme: (theme) => {
		localStorage.setItem("betaapp-theme", theme);
		if (theme === "light") {
			document.documentElement.classList.add("light");
		} else {
			document.documentElement.classList.remove("light");
		}
		set({ theme });
	},
	toasts: [],
	addToast: (toast) =>
		set((s) => ({
			toasts: [...s.toasts, { ...toast, id: crypto.randomUUID() }],
		})),
	removeToast: (id) =>
		set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
