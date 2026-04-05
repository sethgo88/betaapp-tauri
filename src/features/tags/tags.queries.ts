import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	fetchRouteTags,
	fetchTags,
	fetchWallTags,
	setRouteTags,
	setWallTags,
} from "./tags.service";

export function useTags() {
	return useQuery({
		queryKey: ["tags"],
		queryFn: fetchTags,
	});
}

export function useRouteTags(routeId: string) {
	return useQuery({
		queryKey: ["route_tags", routeId],
		queryFn: () => fetchRouteTags(routeId),
		enabled: !!routeId,
	});
}

export function useSetRouteTags(routeId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (tagIds: string[]) => setRouteTags(routeId, tagIds),
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ["route_tags", routeId] });
		},
	});
}

export function useWallTags(wallId: string) {
	return useQuery({
		queryKey: ["wall_tags", wallId],
		queryFn: () => fetchWallTags(wallId),
		enabled: !!wallId,
	});
}

export function useSetWallTags(wallId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (tagIds: string[]) => setWallTags(wallId, tagIds),
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ["wall_tags", wallId] });
		},
	});
}
