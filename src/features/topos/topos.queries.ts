import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import { uploadToStorage } from "@/lib/image-utils";
import { supabase } from "@/lib/supabase";
import type { Point } from "./topos.schema";
import {
	deleteRouteTopo,
	deleteWallTopo,
	deleteWallTopoLine,
	fetchRouteTopo,
	fetchWallTopo,
	fetchWallTopoLines,
	upsertRouteTopo,
	upsertWallTopo,
	upsertWallTopoLine,
} from "./topos.service";

const WALL_TOPO_KEY = "wall-topo";
const WALL_TOPO_LINES_KEY = "wall-topo-lines";
const ROUTE_TOPO_KEY = "route-topo";

// ── Wall topo ─────────────────────────────────────────────────────────────────

export function useWallTopo(wallId: string | null) {
	return useQuery({
		queryKey: [WALL_TOPO_KEY, wallId],
		queryFn: () => fetchWallTopo(wallId as string),
		enabled: !!wallId,
	});
}

export function useWallTopoLines(topoId: string | null) {
	return useQuery({
		queryKey: [WALL_TOPO_LINES_KEY, topoId],
		queryFn: () => fetchWallTopoLines(topoId as string),
		enabled: !!topoId,
	});
}

export function useUploadWallTopoImage(wallId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (file: File) => {
			const user = useAuthStore.getState().user;
			if (!user) throw new Error("Not authenticated");

			const storagePath = await uploadToStorage(
				"route-images",
				`topos/walls/${wallId}/${crypto.randomUUID()}.jpg`,
				file,
			);
			const { data } = supabase.storage
				.from("route-images")
				.getPublicUrl(storagePath);

			await upsertWallTopo(wallId, data.publicUrl, user.id);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [WALL_TOPO_KEY, wallId] });
		},
	});
}

export function useDeleteWallTopo(wallId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, imageUrl }: { id: string; imageUrl: string }) =>
			deleteWallTopo(id, imageUrl),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [WALL_TOPO_KEY, wallId] });
			queryClient.invalidateQueries({ queryKey: [WALL_TOPO_LINES_KEY] });
		},
	});
}

export function useUpsertWallTopoLine(wallId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			topoId,
			routeId,
			points,
			color,
			sortOrder,
		}: {
			topoId: string;
			routeId: string;
			points: Point[];
			color: string;
			sortOrder: number;
		}) => upsertWallTopoLine(topoId, routeId, points, color, sortOrder),
		onSuccess: (
			_data,
			{
				topoId,
			}: {
				topoId: string;
				routeId: string;
				points: Point[];
				color: string;
				sortOrder: number;
			},
		) => {
			queryClient.invalidateQueries({
				queryKey: [WALL_TOPO_LINES_KEY, topoId],
			});
			// Also invalidate route topo queries so fallback display updates
			queryClient.invalidateQueries({ queryKey: [WALL_TOPO_KEY, wallId] });
		},
	});
}

export function useDeleteWallTopoLine(topoId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => deleteWallTopoLine(id),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: [WALL_TOPO_LINES_KEY, topoId],
			});
		},
	});
}

// ── Route topo ────────────────────────────────────────────────────────────────

export function useRouteTopo(routeId: string | null) {
	return useQuery({
		queryKey: [ROUTE_TOPO_KEY, routeId],
		queryFn: () => fetchRouteTopo(routeId as string),
		enabled: !!routeId,
	});
}

export function useUpsertRouteTopo(routeId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			file,
			points,
			color,
		}: {
			file: File | null;
			points: Point[];
			color: string;
		}) => {
			const user = useAuthStore.getState().user;
			if (!user) throw new Error("Not authenticated");

			let imageUrl: string;

			if (file) {
				const storagePath = await uploadToStorage(
					"route-images",
					`topos/routes/${routeId}/${crypto.randomUUID()}.jpg`,
					file,
				);
				const { data } = supabase.storage
					.from("route-images")
					.getPublicUrl(storagePath);
				imageUrl = data.publicUrl;
			} else {
				// Updating points only — get existing URL
				const existing = await fetchRouteTopo(routeId);
				if (!existing) throw new Error("No topo image to update");
				imageUrl = existing.image_url;
			}

			await upsertRouteTopo(routeId, imageUrl, points, color, user.id);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ROUTE_TOPO_KEY, routeId] });
		},
	});
}

export function useDeleteRouteTopo(routeId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, imageUrl }: { id: string; imageUrl: string }) =>
			deleteRouteTopo(id, imageUrl),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ROUTE_TOPO_KEY, routeId] });
		},
	});
}
