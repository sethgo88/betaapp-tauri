import type { Session } from "@supabase/supabase-js";
import "./App.css";
import {
	QueryClient,
	QueryClientProvider,
	useQuery,
} from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import {
	checkPermissions,
	getCurrentPosition,
	requestPermissions,
} from "@tauri-apps/plugin-geolocation";
import { useEffect } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import {
	checkPendingDeepLink,
	fetchAndApplyProfile,
	fetchLocalUser,
	fetchOrCreateSupabaseUser,
	initDeepLinkHandler,
	restoreSession,
	upsertLocalUser,
} from "@/features/auth/auth.service";
import { useAuthStore } from "@/features/auth/auth.store";
import { backfillClimbLocations } from "@/features/climbs/climbs.service";
import { seedGrades } from "@/features/grades/grades-seed";
import { seedTags } from "@/features/tags/tags-seed";
import { useSync } from "@/hooks/useSync";
import { supabase } from "@/lib/supabase";
import { router } from "@/router";
import { useUiStore } from "@/stores/ui.store";

const queryClient = new QueryClient();

async function refreshUserLocation(
	setUserLocation: (loc: { lat: number; lng: number }) => void,
) {
	try {
		let perms = await checkPermissions();
		if (
			perms.location === "prompt" ||
			perms.location === "prompt-with-rationale"
		) {
			perms = await requestPermissions(["location"]);
		}
		if (perms.location !== "granted") return;
		const pos = await getCurrentPosition();
		setUserLocation({
			lat: pos.coords.latitude,
			lng: pos.coords.longitude,
		});
	} catch {
		// Location unavailable — keep using cached value
	}
}

function Bootstrap() {
	const { setUser, setSession, user } = useAuthStore();
	const setUserLocation = useUiStore((s) => s.setUserLocation);
	useSync(user?.id);

	const { isLoading } = useQuery({
		queryKey: ["bootstrap"],
		queryFn: async () => {
			await seedGrades();
			await seedTags();
			await backfillClimbLocations();

			// Refresh user location in background (don't block startup)
			refreshUserLocation(setUserLocation);

			// If device is definitely offline, skip all network calls and load cached local user.
			if (!navigator.onLine) {
				const localUser = await fetchLocalUser();
				if (localUser) setUser(localUser);
				return null;
			}

			// Online path: restore session with a 5-second timeout so an
			// expired-token network refresh cannot hang indefinitely.
			let session: Session | null = null;
			try {
				session = await restoreSession();
			} catch (err) {
				console.warn(
					"[Bootstrap] session restore failed, loading from cache:",
					err,
				);
				// Timed out or failed (captive portal, no upstream). Fall back to local cache.
				const localUser = await fetchLocalUser();
				if (localUser) setUser(localUser);
				return null;
			}

			if (session) {
				setSession(session);
				const role = await fetchOrCreateSupabaseUser(
					session.user.id,
					session.user.email ?? "",
				);
				await upsertLocalUser(session.user.id, session.user.email ?? "", role);
				const user = await fetchAndApplyProfile(session.user.id);
				setUser(user);
			}

			return null;
		},
	});

	// Keep session in sync with Supabase auth state changes
	useEffect(() => {
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((event, session) => {
			setSession(session);
			if (!session) setUser(null);
			if (event === "PASSWORD_RECOVERY" && session) {
				router.navigate({ to: "/reset-password" });
			}
		});
		return () => subscription.unsubscribe();
	}, [setSession, setUser]);

	// Handle deep link callbacks (magic link + password reset)
	useEffect(() => {
		const onDeepLinkSession = async (session: Session) => {
			setSession(session);
			const role = await fetchOrCreateSupabaseUser(
				session.user.id,
				session.user.email ?? "",
			);
			await upsertLocalUser(session.user.id, session.user.email ?? "", role);
			const localUser = await fetchAndApplyProfile(session.user.id);
			setUser(localUser);
			router.navigate({ to: "/" });
		};

		// Check for a deep link URL that launched/resumed the app
		checkPendingDeepLink(onDeepLinkSession);

		// Listen for future deep link URLs while the app is running
		let cleanup: (() => void) | undefined;
		initDeepLinkHandler(onDeepLinkSession).then((unlisten) => {
			cleanup = unlisten;
		});
		return () => cleanup?.();
	}, [setSession, setUser]);

	if (isLoading) {
		return (
			<div className="flex justify-center items-center min-h-screen bg-surface-page">
				<Spinner size="lg" />
			</div>
		);
	}

	return <RouterProvider router={router} />;
}

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<Bootstrap />
		</QueryClientProvider>
	);
}

export default App;
