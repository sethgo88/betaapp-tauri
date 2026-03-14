import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import { fetchPersonalCrags } from "./map.service";

export function usePersonalCrags() {
	const userId = useAuthStore((s) => s.user?.id ?? "");
	return useQuery({
		queryKey: ["personal_crags", userId],
		queryFn: () => fetchPersonalCrags(userId),
		enabled: !!userId,
	});
}
