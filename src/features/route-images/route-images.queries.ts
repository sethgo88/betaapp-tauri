import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import { uploadToStorage } from "@/lib/image-utils";
import { supabase } from "@/lib/supabase";
import {
	deleteRouteImage,
	deleteWallImage,
	fetchRouteImages,
	fetchWallImages,
	insertRouteImage,
	insertWallImage,
} from "./route-images.service";

const ROUTE_IMAGES_KEY = "route-images";
const WALL_IMAGES_KEY = "wall-images";

// ── Route image queries ───────────────────────────────────────────────────────

export function useRouteImages(routeId: string) {
	return useQuery({
		queryKey: [ROUTE_IMAGES_KEY, routeId],
		queryFn: () => fetchRouteImages(routeId),
	});
}

export function useAddRouteImage(routeId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (file: File) => {
			const user = useAuthStore.getState().user;
			if (!user) throw new Error("Not authenticated");

			const existing = await fetchRouteImages(routeId);
			const sortOrder = existing.length;

			const storagePath = await uploadToStorage(
				"route-images",
				`routes/${routeId}/${crypto.randomUUID()}.jpg`,
				file,
			);
			const { data } = supabase.storage
				.from("route-images")
				.getPublicUrl(storagePath);

			await insertRouteImage(routeId, user.id, data.publicUrl, sortOrder);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ROUTE_IMAGES_KEY, routeId] });
		},
	});
}

export function useDeleteRouteImage(routeId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ id, imageUrl }: { id: string; imageUrl: string }) => {
			// Extract the storage path from the public URL
			const marker = "/storage/v1/object/public/route-images/";
			const storagePath = imageUrl.includes(marker)
				? imageUrl.split(marker)[1]
				: null;

			await deleteRouteImage(id);
			if (storagePath) {
				await supabase.storage.from("route-images").remove([storagePath]);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [ROUTE_IMAGES_KEY, routeId] });
		},
	});
}

// ── Wall image queries ────────────────────────────────────────────────────────

export function useWallImages(wallId: string) {
	return useQuery({
		queryKey: [WALL_IMAGES_KEY, wallId],
		queryFn: () => fetchWallImages(wallId),
	});
}

export function useAddWallImage(wallId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (file: File) => {
			const user = useAuthStore.getState().user;
			if (!user) throw new Error("Not authenticated");

			const existing = await fetchWallImages(wallId);
			const sortOrder = existing.length;

			const storagePath = await uploadToStorage(
				"route-images",
				`walls/${wallId}/${crypto.randomUUID()}.jpg`,
				file,
			);
			const { data } = supabase.storage
				.from("route-images")
				.getPublicUrl(storagePath);

			await insertWallImage(wallId, user.id, data.publicUrl, sortOrder);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [WALL_IMAGES_KEY, wallId] });
		},
	});
}

export function useDeleteWallImage(wallId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ id, imageUrl }: { id: string; imageUrl: string }) => {
			const marker = "/storage/v1/object/public/route-images/";
			const storagePath = imageUrl.includes(marker)
				? imageUrl.split(marker)[1]
				: null;

			await deleteWallImage(id);
			if (storagePath) {
				await supabase.storage.from("route-images").remove([storagePath]);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [WALL_IMAGES_KEY, wallId] });
		},
	});
}
