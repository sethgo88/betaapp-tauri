import { useRouter } from "@tanstack/react-router";
import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { useUiStore } from "@/stores/ui.store";

/**
 * Intercepts the Android hardware back button.
 * - If a `backHandlerOverride` is set in the UI store (e.g. a modal is open),
 *   calls that instead of navigating back.
 * - Navigates back if there is history.
 * - Does nothing at the root so the OS can close the app naturally.
 *
 * Call once in AppLayout. No-ops on web.
 */
export function useAndroidBackButton() {
	const router = useRouter();
	const backHandlerOverride = useUiStore((s) => s.backHandlerOverride);

	useEffect(() => {
		if (!isTauri()) return;

		// Dynamic import avoids bundling the Tauri app API into the web bundle.
		// The promise is captured so cleanup can always unregister the listener.
		let cancelCleanup = false;
		let unregister: (() => void) | undefined;

		import("@tauri-apps/api/app").then(({ onBackButtonPress }) => {
			if (cancelCleanup) return;
			onBackButtonPress(() => {
				if (backHandlerOverride) {
					backHandlerOverride();
					return;
				}
				if (router.history.length > 1) {
					router.history.back();
				}
				// At root: do not call preventDefault — let the OS handle it (closes app)
			}).then((listener) => {
				if (cancelCleanup) {
					listener.unregister();
				} else {
					unregister = () => listener.unregister();
				}
			});
		});

		return () => {
			cancelCleanup = true;
			unregister?.();
		};
	}, [router, backHandlerOverride]);
}
