import "./App.css";
import {
	QueryClient,
	QueryClientProvider,
	useQuery,
} from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useEffect } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import { fetchCurrentUser } from "@/features/auth/auth.service";
import { useAuthStore } from "@/features/auth/auth.store";
import { seedGrades } from "@/features/grades/grades-seed";
import { router } from "@/router";

const queryClient = new QueryClient();

function Bootstrap() {
	const setUser = useAuthStore((s) => s.setUser);

	const { data: user, isLoading } = useQuery({
		queryKey: ["bootstrap"],
		queryFn: async () => {
			await seedGrades();
			return fetchCurrentUser();
		},
	});

	useEffect(() => {
		setUser(user ?? null);
	}, [user, setUser]);

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
