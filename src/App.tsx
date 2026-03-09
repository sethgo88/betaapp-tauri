import "./App.css";
import {
	QueryClient,
	QueryClientProvider,
	useQuery,
} from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { useEffect } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import {
	fetchOrCreateSupabaseUser,
	handleAuthCallback,
	restoreSession,
	upsertLocalUser,
} from "@/features/auth/auth.service";
import { useAuthStore } from "@/features/auth/auth.store";
import { seedGrades } from "@/features/grades/grades-seed";
import { supabase } from "@/lib/supabase";
import { router } from "@/router";

const queryClient = new QueryClient();

function Bootstrap() {
	const { setUser, setSession } = useAuthStore();

	const { isLoading } = useQuery({
		queryKey: ["bootstrap"],
		queryFn: async () => {
			await seedGrades();

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
		} = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
			if (!session) setUser(null);
		});
		return () => subscription.unsubscribe();
	}, [setSession, setUser]);

	// Deep link listener — handles magic link callback
	useEffect(() => {
		let unlisten: (() => void) | undefined;

		onOpenUrl(async (urls) => {
			for (const url of urls) {
				if (!url.startsWith("betaapp://auth/callback")) continue;
				const session = await handleAuthCallback(url);
				if (!session) continue;
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
				router.navigate({ to: "/" });
			}
		}).then((fn) => {
			unlisten = fn;
		});

		return () => unlisten?.();
	}, [setSession, setUser]);

	if (isLoading) {
		return (
			<div className="flex justify-center items-center min-h-screen bg-stone-700">
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
