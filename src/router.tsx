import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
} from "@tanstack/react-router";
import { AppLayout } from "@/components/templates/AppLayout";
import AddClimbView from "@/views/AddClimbView";
import ClimbDetailView from "@/views/ClimbDetailView";
import EditClimbView from "@/views/EditClimbView";
import HomeView from "@/views/HomeView";
import ProfileView from "@/views/ProfileView";

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
	component: HomeView,
});

const addClimbRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/climbs/add",
	component: AddClimbView,
});

const climbDetailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/climbs/$climbId",
	component: ClimbDetailView,
});

const editClimbRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/climbs/$climbId/edit",
	component: EditClimbView,
});

const profileRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/profile",
	component: ProfileView,
});

const routeTree = rootRoute.addChildren([
	homeRoute,
	addClimbRoute,
	climbDetailRoute,
	editClimbRoute,
	profileRoute,
]);

const memoryHistory = createMemoryHistory({ initialEntries: ["/"] });

export const router = createRouter({ routeTree, history: memoryHistory });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
