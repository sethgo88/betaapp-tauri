import { useQuery } from "@tanstack/react-query";
import { fetchRoutes } from "./routes.service";

export function useRoutes(wallId: string | null) {
	return useQuery({
		queryKey: ["routes", wallId],
		queryFn: () => fetchRoutes(wallId ?? ""),
		enabled: !!wallId,
	});
}
