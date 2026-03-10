import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import type { RouteSubmitValues } from "./routes.schema";
import { fetchRoutes, submitRoute } from "./routes.service";

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
