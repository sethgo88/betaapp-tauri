import "./App.css";
import {
	QueryClient,
	QueryClientProvider,
	useQuery,
} from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import {
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

const queryClient = new QueryClient();

function Bootstrap() {
	const { setUser, setSession, user } = useAuthStore();
	useSync(user?.id);

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

	// Handle magic link deep link callbacks
	useEffect(() => {
		let cleanup: (() => void) | undefined;
		initDeepLinkHandler((session) => {
			setSession(session);
		}).then((unlisten) => {
			cleanup = unlisten;
		});
		return () => cleanup?.();
	}, [setSession]);

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
