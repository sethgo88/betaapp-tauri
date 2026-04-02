import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	redirect,
	useParams,
} from "@tanstack/react-router";
import { z } from "zod";
import { AppLayout } from "@/components/templates/AppLayout";
import { useAuthStore } from "@/features/auth/auth.store";
import AddClimbView from "@/views/AddClimbView";
import AddEditRouteView from "@/views/AddEditRouteView";
import AddLocationView from "@/views/AddLocationView";
import LocationManagerView from "@/views/admin/LocationManagerView";
import VerificationView from "@/views/admin/VerificationView";
import ClimbDetailView from "@/views/ClimbDetailView";
import CragView from "@/views/CragView";
import HomeView from "@/views/HomeView";
import MapView from "@/views/MapView";
import ProfileView from "@/views/ProfileView";
import RegionView from "@/views/RegionView";
import ResetPasswordView from "@/views/ResetPasswordView";
import RouteDetailView from "@/views/RouteDetailView";
import RoutesView from "@/views/RoutesView";
import SearchView from "@/views/SearchView";
import StatsView from "@/views/StatsView";
import SubmitRouteView from "@/views/SubmitRouteView";
import SubRegionView from "@/views/SubRegionView";
import WallView from "@/views/WallView";

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
	validateSearch: z.object({
		routeId: z.string().optional(),
		routeName: z.string().optional(),
		grade: z.string().optional(),
		routeType: z.enum(["sport", "boulder", "trad"]).optional(),
	}),
	component: AddClimbView,
});

const climbDetailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/climbs/$climbId",
	beforeLoad: requireAuth,
	component: ClimbDetailView,
});

const profileRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/profile",
	component: ProfileView,
});

const resetPasswordRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/reset-password",
	component: ResetPasswordView,
});

const mapRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/map",
	beforeLoad: requireAuth,
	validateSearch: z.object({
		lat: z.number().optional(),
		lng: z.number().optional(),
		zoom: z.number().optional(),
	}),
	component: MapView,
});

const searchRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/search",
	beforeLoad: requireAuth,
	component: SearchView,
});

const routesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/routes",
	beforeLoad: requireAuth,
	component: RoutesView,
});

const regionRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/regions/$regionId",
	beforeLoad: requireAuth,
	component: RegionView,
});

const cragRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/crags/$cragId",
	beforeLoad: requireAuth,
	component: CragView,
});

const subRegionRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/sub-regions/$subRegionId",
	beforeLoad: requireAuth,
	component: SubRegionView,
});

const wallRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/walls/$wallId",
	beforeLoad: requireAuth,
	component: WallView,
});

const routeDetailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/routes/$routeId",
	beforeLoad: requireAuth,
	component: RouteDetailView,
});

const submitRouteRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/routes/submit",
	beforeLoad: requireAuth,
	validateSearch: z.object({
		wallId: z.string(),
		wallName: z.string(),
	}),
	component: SubmitRouteView,
});

const addRouteRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/routes/add",
	beforeLoad: requireAuth,
	component: AddEditRouteView,
});

const EditRouteWrapper = () => {
	const { routeId } = useParams({ from: "/routes/$routeId/edit" });
	return <AddEditRouteView routeId={routeId} />;
};

const editRouteRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/routes/$routeId/edit",
	beforeLoad: requireAuth,
	component: EditRouteWrapper,
});

const addLocationRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/locations/add",
	beforeLoad: requireAuth,
	component: AddLocationView,
});

const statsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/stats",
	beforeLoad: requireAuth,
	component: StatsView,
});

const adminLocationsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/admin/locations",
	beforeLoad: requireAdmin,
	component: LocationManagerView,
});

const adminVerificationRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/admin/verify",
	beforeLoad: requireAdmin,
	component: VerificationView,
});

const routeTree = rootRoute.addChildren([
	homeRoute,
	addClimbRoute,
	climbDetailRoute,
	profileRoute,
	resetPasswordRoute,
	mapRoute,
	searchRoute,
	routesRoute,
	addRouteRoute,
	submitRouteRoute,
	editRouteRoute,
	regionRoute,
	subRegionRoute,
	cragRoute,
	wallRoute,
	routeDetailRoute,
	addLocationRoute,
	statsRoute,
	adminLocationsRoute,
	adminVerificationRoute,
]);

const memoryHistory = createMemoryHistory({ initialEntries: ["/"] });

export const router = createRouter({ routeTree, history: memoryHistory });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
