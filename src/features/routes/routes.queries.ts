import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import type { RouteSubmitValues } from "./routes.schema";
import {
	fetchRoutes,
	fetchUnverifiedRoutes,
	mergeRoute,
	rejectRoute,
	submitRoute,
	updateRouteFields,
	verifyRoute,
} from "./routes.service";

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
			const userId = useAuthStore.getState().user?.id ?? "";
			return submitRoute(values, userId);
		},
		onSuccess: (_data, values) => {
			qc.invalidateQueries({ queryKey: ["routes", values.wall_id] });
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

export function useVerifyRoute() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => verifyRoute(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["unverified_routes"] });
		},
	});
}

export function useRejectRoute() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => rejectRoute(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["unverified_routes"] });
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
		},
	});
}

export function useMergeRoute() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (unverifiedId: string) => mergeRoute(unverifiedId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["unverified_routes"] });
		},
	});
}
