import { useRouter } from "@tanstack/react-router";
import { onBackButtonPress } from "@tauri-apps/api/app";
import { useEffect } from "react";
import { useUiStore } from "@/stores/ui.store";

/**
 * Intercepts the Android hardware back button.
 * - If a `backHandlerOverride` is set in the UI store (e.g. a modal is open),
 *   calls that instead of navigating back.
 * - Navigates back if there is history.
 * - Does nothing at the root so the OS can close the app naturally.
 *
 * Call once in AppLayout.
 */
export function useAndroidBackButton() {
	const router = useRouter();
	const backHandlerOverride = useUiStore((s) => s.backHandlerOverride);

	useEffect(() => {
		const unlistenPromise = onBackButtonPress(() => {
			if (backHandlerOverride) {
				backHandlerOverride();
				return;
			}
			if (router.history.length > 1) {
				router.history.back();
			}
			// At root: do not call preventDefault — let the OS handle it (closes app)
		});

		return () => {
			unlistenPromise.then((listener) => listener.unregister());
		};
	}, [router, backHandlerOverride]);
}
