import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import {
	fetchClimbsAtPin,
	fetchPersonalCrags,
	fetchPersonalWalls,
} from "./map.service";

export function usePersonalCrags() {
	const userId = useAuthStore((s) => s.user?.id ?? "");
	return useQuery({
		queryKey: ["personal_crags", userId],
		queryFn: () => fetchPersonalCrags(userId),
		enabled: !!userId,
	});
}

export function usePersonalWalls() {
	const userId = useAuthStore((s) => s.user?.id ?? "");
	return useQuery({
		queryKey: ["personal_walls", userId],
		queryFn: () => fetchPersonalWalls(userId),
		enabled: !!userId,
	});
}

export function useClimbsAtPin(
	pinType: "crag" | "wall" | null,
	pinId: string | null,
) {
	const userId = useAuthStore((s) => s.user?.id ?? "");
	return useQuery({
		queryKey: ["pin_climbs", userId, pinType, pinId],
		queryFn: () => fetchClimbsAtPin(userId, pinType!, pinId!),
		enabled: !!userId && !!pinType && !!pinId,
	});
}
