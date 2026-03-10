import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { AppLayout } from "@/components/templates/AppLayout";
import { useAuthStore } from "@/features/auth/auth.store";
import AddClimbView from "@/views/AddClimbView";
import LocationManagerView from "@/views/admin/LocationManagerView";
import ClimbDetailView from "@/views/ClimbDetailView";
import EditClimbView from "@/views/EditClimbView";
import HomeView from "@/views/HomeView";
import ProfileView from "@/views/ProfileView";
import RoutesView from "@/views/RoutesView";

const requireAuth = () => {
	if (!useAuthStore.getState().isAuthenticated) {
		throw redirect({ to: "/profile" });
	}
};

const requireAdmin = () => {
	const { isAuthenticated, user } = useAuthStore.getState();
	if (!isAuthenticated) throw redirect({ to: "/profile" });
	if (user?.role !== "admin") throw redirect({ to: "/" });
};

const rootRoute = createRootRoute({
	component: () => (
		<AppLayout>
			<Outlet />
		</AppLayout>
	),
});

const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	beforeLoad: requireAuth,
	component: HomeView,
});

const addClimbRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/climbs/add",
	beforeLoad: requireAuth,
	component: AddClimbView,
});

const climbDetailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/climbs/$climbId",
	beforeLoad: requireAuth,
	component: ClimbDetailView,
});

const editClimbRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/climbs/$climbId/edit",
	beforeLoad: requireAuth,
	component: EditClimbView,
});

const profileRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/profile",
	component: ProfileView,
});

const routesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/routes",
	beforeLoad: requireAuth,
	component: RoutesView,
});

const adminLocationsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/admin/locations",
	beforeLoad: requireAdmin,
	component: LocationManagerView,
});

const routeTree = rootRoute.addChildren([
	homeRoute,
	addClimbRoute,
	climbDetailRoute,
	editClimbRoute,
	profileRoute,
	routesRoute,
	adminLocationsRoute,
]);

const memoryHistory = createMemoryHistory({ initialEntries: ["/"] });

export const router = createRouter({ routeTree, history: memoryHistory });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
