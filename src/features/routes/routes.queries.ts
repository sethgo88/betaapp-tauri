import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import type { RouteSubmitValues } from "./routes.schema";
import {
	addRoute,
	addRouteLink,
	adminDeleteRoute,
	deleteRouteLink,
	editRoute,
	fetchAllRoutes,
	fetchRoute,
	fetchRouteBodyStats,
	fetchRouteLinks,
	fetchRoutes,
	fetchUnverifiedRoutes,
	mergeRoute,
	rejectRoute,
	searchLocalRoutes,
	updateRouteDescription,
	updateRouteFields,
	verifyRoute,
} from "./routes.service";

export function useRoute(id: string | null | undefined) {
	return useQuery({
		queryKey: ["route", id],
		queryFn: () => fetchRoute(id ?? ""),
		enabled: !!id,
	});
}

export function useRoutes(wallId: string | null) {
	return useQuery({
		queryKey: ["routes", wallId],
		queryFn: () => fetchRoutes(wallId ?? ""),
		enabled: !!wallId,
	});
}

export function useSubmitRoute() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (values: RouteSubmitValues) => {
			const { user } = useAuthStore.getState();
			const userId = user?.id ?? "";
			const isAdmin = user?.role === "admin";
			return addRoute(values, userId, isAdmin);
		},
		onSuccess: (_data, values) => {
			qc.invalidateQueries({ queryKey: ["routes", values.wall_id] });
			qc.invalidateQueries({ queryKey: ["all_routes"] });
		},
	});
}

export function useSearchLocalRoutes(query: string) {
	return useQuery({
		queryKey: ["search_local_routes", query],
		queryFn: () => searchLocalRoutes(query),
		enabled: query.length >= 2,
	});
}

export function useUpdateRouteDescription() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, description }: { id: string; description: string }) =>
			updateRouteDescription(id, description),
		onSuccess: (_data, { id }) => {
			qc.invalidateQueries({ queryKey: ["route", id] });
		},
	});
}

export function useAddRoute() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			values,
			userId,
			isAdmin,
		}: {
			values: RouteSubmitValues;
			userId: string;
			isAdmin: boolean;
		}) => addRoute(values, userId, isAdmin),
		onSuccess: (_data, { values }) => {
			qc.invalidateQueries({ queryKey: ["routes", values.wall_id] });
			qc.invalidateQueries({ queryKey: ["all_routes"] });
		},
	});
}

export function useEditRoute() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			values,
		}: {
			id: string;
			values: {
				wall_id: string;
				name: string;
				grade: string;
				route_type: "sport" | "boulder";
				description?: string;
			};
		}) => editRoute(id, values),
		onSuccess: (_data, { id, values }) => {
			qc.invalidateQueries({ queryKey: ["route", id] });
			qc.invalidateQueries({ queryKey: ["routes", values.wall_id] });
			qc.invalidateQueries({ queryKey: ["all_routes"] });
		},
	});
}

export function useAdminDeleteRoute() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id }: { id: string; wallId: string }) =>
			adminDeleteRoute(id),
		onSuccess: (_data, { wallId }) => {
			qc.invalidateQueries({ queryKey: ["routes", wallId] });
			qc.invalidateQueries({ queryKey: ["all_routes"] });
		},
	});
}

// ── Admin queries ─────────────────────────────────────────────────────────────

export function useUnverifiedRoutes() {
	return useQuery({
		queryKey: ["unverified_routes"],
		queryFn: fetchUnverifiedRoutes,
	});
}

export function useAllRoutes() {
	return useQuery({
		queryKey: ["all_routes"],
		queryFn: fetchAllRoutes,
	});
}

export function useVerifyRoute() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => verifyRoute(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["unverified_routes"] });
			qc.invalidateQueries({ queryKey: ["all_routes"] });
		},
	});
}

export function useRejectRoute() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => rejectRoute(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["unverified_routes"] });
			qc.invalidateQueries({ queryKey: ["all_routes"] });
		},
	});
}

export function useUpdateRouteFields() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			values,
		}: {
			id: string;
			values: {
				name: string;
				grade: string;
				route_type: "sport" | "boulder";
				description?: string;
			};
		}) => updateRouteFields(id, values),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["unverified_routes"] });
			qc.invalidateQueries({ queryKey: ["all_routes"] });
		},
	});
}

export function useMergeRoute() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			unverifiedId,
			targetId,
		}: {
			unverifiedId: string;
			targetId: string;
		}) => mergeRoute(unverifiedId, targetId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["unverified_routes"] });
			qc.invalidateQueries({ queryKey: ["all_routes"] });
		},
	});
}

// ── Route body stats ──────────────────────────────────────────────────────────

export function useRouteBodyStats(routeId: string) {
	return useQuery({
		queryKey: ["route_body_stats", routeId],
		queryFn: () => fetchRouteBodyStats(routeId),
		enabled: !!routeId,
	});
}

// ── Route links ───────────────────────────────────────────────────────────────

export function useRouteLinks(routeId: string) {
	return useQuery({
		queryKey: ["route_links", routeId],
		queryFn: () => fetchRouteLinks(routeId),
	});
}

export function useAddRouteLink(routeId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			url,
			title,
			userId,
		}: {
			url: string;
			title?: string;
			userId: string;
		}) => addRouteLink(routeId, userId, url, title),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["route_links", routeId] });
		},
	});
}

export function useDeleteRouteLink(routeId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteRouteLink(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["route_links", routeId] });
		},
	});
}
