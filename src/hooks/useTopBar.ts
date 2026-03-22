import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	useCrag,
	useCrags,
	useRegion,
	useRegions,
	useSubRegion,
	useSubRegions,
	useWall,
	useWalls,
} from "@/features/locations/locations.queries";
import { useRoute, useRoutes } from "@/features/routes/routes.queries";

export type Sibling = {
	id: string;
	label: string;
	sublabel?: string;
	isCurrent: boolean;
};

export type TopBarState = {
	/** Text for the back button (parent name, "Home", or null for no back button) */
	backLabel: string | null;
	/** Navigate to the back target */
	goBack: () => void;
	/** Sibling items for the dropdown */
	siblings: Sibling[];
	/** Navigate to a sibling by id */
	goToSibling: (id: string) => void;
};

function extractParam(pathname: string, prefix: string): string | null {
	if (pathname.startsWith(prefix)) {
		const rest = pathname.slice(prefix.length);
		if (!rest.includes("/")) return rest || null;
	}
	return null;
}

export function useTopBar(): TopBarState {
	const { pathname, search } = useRouterState({
		select: (s) => ({
			pathname: s.location.pathname,
			search: s.location.search as Record<string, unknown>,
		}),
	});
	const navigate = useNavigate();

	const goHome = () => navigate({ to: "/" });

	// ── Parse route params ─────────────────────────────────────────────────────

	const routeDetailId = extractParam(pathname, "/routes/");
	// Avoid matching /routes/submit, /routes/add, /routes/*/edit
	const isRouteDetail =
		!!routeDetailId &&
		routeDetailId !== "submit" &&
		routeDetailId !== "add" &&
		!pathname.endsWith("/edit");

	const wallId = extractParam(pathname, "/walls/");
	const cragId = extractParam(pathname, "/crags/");
	const subRegionId = extractParam(pathname, "/sub-regions/");
	const regionId = extractParam(pathname, "/regions/");

	// SubmitRouteView has wallId in search params
	const isSubmitRoute = pathname === "/routes/submit";
	const submitWallId = isSubmitRoute
		? ((search.wallId as string | undefined) ?? null)
		: null;

	// EditRouteView: /routes/$routeId/edit
	const editRouteMatch = pathname.match(/^\/routes\/([^/]+)\/edit$/);
	const editRouteId = editRouteMatch?.[1] ?? null;

	// EditClimbView: /climbs/$climbId/edit
	const editClimbMatch = pathname.match(/^\/climbs\/([^/]+)\/edit$/);
	const editClimbId = editClimbMatch?.[1] ?? null;

	// ── Fetch entities for hierarchy views ──────────────────────────────────────

	// Route detail: need route → wall (parent) + sibling routes
	const { data: route } = useRoute(isRouteDetail ? routeDetailId : null);
	const routeWallId = route?.wall_id ?? null;
	const { data: routeWall } = useWall(isRouteDetail ? routeWallId : null);
	const { data: siblingRoutes = [] } = useRoutes(
		isRouteDetail ? routeWallId : null,
	);

	// Wall view: need wall → crag (parent) + sibling walls
	const { data: wall } = useWall(wallId);
	const wallCragId = wall?.crag_id ?? null;
	const { data: wallCrag } = useCrag(wallId ? wallCragId : null);
	const { data: siblingWalls = [] } = useWalls(wallId ? wallCragId : null);

	// Crag view: need crag → sub-region (parent) + sibling crags
	const { data: crag } = useCrag(cragId);
	const cragSubRegionId = crag?.sub_region_id ?? null;
	const { data: cragSubRegion } = useSubRegion(cragId ? cragSubRegionId : null);
	const { data: siblingCrags = [] } = useCrags(cragId ? cragSubRegionId : null);

	// Sub-region view: need sub-region → region (parent) + sibling sub-regions
	const { data: subRegion } = useSubRegion(subRegionId);
	const subRegionRegionId = subRegion?.region_id ?? null;
	const { data: subRegionParent } = useRegion(
		subRegionId ? subRegionRegionId : null,
	);
	const { data: siblingSubRegions = [] } = useSubRegions(
		subRegionId ? subRegionRegionId : null,
	);

	// Region view: need region → country (parent) + sibling regions
	const { data: region } = useRegion(regionId);
	const regionCountryId = region?.country_id ?? null;
	const { data: siblingRegions = [] } = useRegions(
		regionId ? regionCountryId : null,
	);

	// SubmitRouteView: need wall name for back button
	const { data: submitWall } = useWall(submitWallId);

	// ── Build result based on current route ─────────────────────────────────────

	// RouteDetailView
	if (isRouteDetail && routeDetailId) {
		return {
			backLabel: routeWall?.name ?? "…",
			goBack: () => {
				if (routeWallId) {
					navigate({
						to: "/walls/$wallId",
						params: { wallId: routeWallId },
					});
				}
			},
			siblings: siblingRoutes.map((r) => ({
				id: r.id,
				label: r.name,
				sublabel: r.grade,
				isCurrent: r.id === routeDetailId,
			})),
			goToSibling: (id) =>
				navigate({ to: "/routes/$routeId", params: { routeId: id } }),
		};
	}

	// WallView
	if (wallId) {
		return {
			backLabel: wallCrag?.name ?? "…",
			goBack: () => {
				if (wallCragId) {
					navigate({
						to: "/crags/$cragId",
						params: { cragId: wallCragId },
					});
				}
			},
			siblings: siblingWalls.map((w) => ({
				id: w.id,
				label: w.name,
				sublabel: w.wall_type === "boulder" ? "Boulder" : undefined,
				isCurrent: w.id === wallId,
			})),
			goToSibling: (id) =>
				navigate({ to: "/walls/$wallId", params: { wallId: id } }),
		};
	}

	// CragView
	if (cragId) {
		return {
			backLabel: cragSubRegion?.name ?? "…",
			goBack: () => {
				if (cragSubRegionId) {
					navigate({
						to: "/sub-regions/$subRegionId",
						params: { subRegionId: cragSubRegionId },
					});
				}
			},
			siblings: siblingCrags.map((c) => ({
				id: c.id,
				label: c.name,
				isCurrent: c.id === cragId,
			})),
			goToSibling: (id) =>
				navigate({ to: "/crags/$cragId", params: { cragId: id } }),
		};
	}

	// SubRegionView
	if (subRegionId) {
		return {
			backLabel: subRegionParent?.name ?? "…",
			goBack: () => {
				if (subRegionRegionId) {
					navigate({
						to: "/regions/$regionId",
						params: { regionId: subRegionRegionId },
					});
				}
			},
			siblings: siblingSubRegions.map((sr) => ({
				id: sr.id,
				label: sr.name,
				isCurrent: sr.id === subRegionId,
			})),
			goToSibling: (id) =>
				navigate({
					to: "/sub-regions/$subRegionId",
					params: { subRegionId: id },
				}),
		};
	}

	// RegionView
	if (regionId) {
		return {
			backLabel: "Routes",
			goBack: () => navigate({ to: "/routes" }),
			siblings: siblingRegions.map((r) => ({
				id: r.id,
				label: r.name,
				isCurrent: r.id === regionId,
			})),
			goToSibling: (id) =>
				navigate({ to: "/regions/$regionId", params: { regionId: id } }),
		};
	}

	// EditClimbView → ClimbDetailView
	if (editClimbId) {
		return {
			backLabel: "Back",
			goBack: () =>
				navigate({
					to: "/climbs/$climbId",
					params: { climbId: editClimbId },
				}),
			siblings: [],
			goToSibling: () => {},
		};
	}

	// EditRouteView → RouteDetailView
	if (editRouteId) {
		return {
			backLabel: "Back",
			goBack: () =>
				navigate({
					to: "/routes/$routeId",
					params: { routeId: editRouteId },
				}),
			siblings: [],
			goToSibling: () => {},
		};
	}

	// SubmitRouteView → WallView
	if (isSubmitRoute && submitWallId) {
		return {
			backLabel: submitWall?.name ?? "Back",
			goBack: () =>
				navigate({
					to: "/walls/$wallId",
					params: { wallId: submitWallId },
				}),
			siblings: [],
			goToSibling: () => {},
		};
	}

	// ResetPasswordView — no back button
	if (pathname === "/reset-password") {
		return {
			backLabel: null,
			goBack: () => {},
			siblings: [],
			goToSibling: () => {},
		};
	}

	// HomeView — no back button
	if (pathname === "/") {
		return {
			backLabel: null,
			goBack: () => {},
			siblings: [],
			goToSibling: () => {},
		};
	}

	// Everything else → Home
	return {
		backLabel: "Home",
		goBack: goHome,
		siblings: [],
		goToSibling: () => {},
	};
}
