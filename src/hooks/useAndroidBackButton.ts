import { useRouter } from "@tanstack/react-router";
import { onBackButtonPress } from "@tauri-apps/api/app";
import { useEffect } from "react";

/**
 * Intercepts the Android hardware back button.
 * - Navigates back if there is history.
 * - Does nothing at the root so the OS can close the app naturally.
 *
 * Call once in AppLayout.
 */
export function useAndroidBackButton() {
	const router = useRouter();

	useEffect(() => {
		const unlistenPromise = onBackButtonPress(() => {
			if (router.history.length > 1) {
				router.history.back();
			}
			// At root: do not call preventDefault — let the OS handle it (closes app)
		});

		return () => {
			unlistenPromise.then((listener) => listener.unregister());
		};
	}, [router]);
}
