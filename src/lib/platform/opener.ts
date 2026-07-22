import { isTauri } from "@tauri-apps/api/core";

/**
 * Opens a URL externally. Uses the Tauri opener plugin on Android/desktop,
 * and window.open on web.
 */
export async function openExternalUrl(url: string): Promise<void> {
	if (isTauri()) {
		const { openUrl } = await import("@tauri-apps/plugin-opener");
		await openUrl(url);
	} else {
		window.open(url, "_blank", "noopener,noreferrer");
	}
}
