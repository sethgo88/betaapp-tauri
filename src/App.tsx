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
	fetchOrCreateSupabaseUser,
	initDeepLinkHandler,
	restoreSession,
	upsertLocalUser,
} from "@/features/auth/auth.service";
import { useAuthStore } from "@/features/auth/auth.store";
import { seedGrades } from "@/features/grades/grades-seed";
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

			// Refresh user location in background (don't block startup)
			refreshUserLocation(setUserLocation);

			const session = await restoreSession();
			if (session) {
				setSession(session);
				const role = await fetchOrCreateSupabaseUser(
					session.user.id,
					session.user.email ?? "",
				);
				const user = await upsertLocalUser(
					session.user.id,
					session.user.email ?? "",
					role,
				);
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
			const localUser = await upsertLocalUser(
				session.user.id,
				session.user.email ?? "",
				role,
			);
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
