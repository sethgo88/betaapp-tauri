import { create } from "zustand";

export type Theme = "dark" | "light";

export type Toast = {
	id: string;
	message: string;
	type: "success" | "error" | "warning";
};

export type UserLocation = { lat: number; lng: number };

interface UiStore {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	toasts: Toast[];
	addToast: (toast: Omit<Toast, "id">) => void;
	removeToast: (id: string) => void;
	userLocation: UserLocation | null;
	setUserLocation: (loc: UserLocation) => void;
	/** When set, the Android back button calls this instead of navigating back. */
	backHandlerOverride: (() => void) | null;
	setBackHandlerOverride: (fn: (() => void) | null) => void;
	defaultStatusFilters: Set<string>;
	setDefaultStatusFilters: (filters: Set<string>) => void;
}

const storedTheme =
	(localStorage.getItem("betaapp-theme") as Theme | null) ?? "dark";

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

const storedLocation: UserLocation | null = (() => {
	try {
		const raw = localStorage.getItem("betaapp-user-location");
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (typeof parsed.lat === "number" && typeof parsed.lng === "number")
			return parsed;
		return null;
	} catch {
		return null;
	}
})();

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
	userLocation: storedLocation,
	setUserLocation: (loc) => {
		localStorage.setItem("betaapp-user-location", JSON.stringify(loc));
		set({ userLocation: loc });
	},
	backHandlerOverride: null,
	setBackHandlerOverride: (fn) => set({ backHandlerOverride: fn }),
	defaultStatusFilters: storedDefaultStatusFilters,
	setDefaultStatusFilters: (filters) => {
		localStorage.setItem(
			"betaapp-default-status-filters",
			JSON.stringify([...filters]),
		);
		set({ defaultStatusFilters: filters });
	},
}));
