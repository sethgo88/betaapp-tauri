import { isTauri } from "@tauri-apps/api/core";

/**
 * Returns the user's current location, or null if unavailable/denied.
 * Uses the Tauri geolocation plugin on Android, and the browser Geolocation
 * API on web.
 */
export async function getCurrentLocation(): Promise<{
	lat: number;
	lng: number;
} | null> {
	if (isTauri()) {
		const { checkPermissions, getCurrentPosition, requestPermissions } =
			await import("@tauri-apps/plugin-geolocation");
		let perms = await checkPermissions();
		if (
			perms.location === "prompt" ||
			perms.location === "prompt-with-rationale"
		) {
			perms = await requestPermissions(["location"]);
		}
		if (perms.location !== "granted") return null;
		const pos = await getCurrentPosition();
		return { lat: pos.coords.latitude, lng: pos.coords.longitude };
	}

	return new Promise((resolve) => {
		if (!navigator.geolocation) {
			resolve(null);
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
			() => resolve(null),
			{ timeout: 10_000 },
		);
	});
}
