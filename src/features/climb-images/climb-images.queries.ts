import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import { uploadToStorage } from "@/lib/image-utils";
import { supabase } from "@/lib/supabase";
import { useUiStore } from "@/stores/ui.store";
import type { PinType } from "./climb-images.schema";
import {
	deleteClimbImagePin,
	fetchClimbImagePins,
	fetchClimbImages,
	getClimbImageSortOrder,
	getUserImageCount,
	insertClimbImage,
	insertClimbImagePin,
	reorderClimbImages,
	softDeleteClimbImage,
	updateClimbImagePin,
} from "./climb-images.service";

const CLIMB_IMAGES_KEY = "climb-images";
const CLIMB_IMAGE_PINS_KEY = "climb-image-pins";
const USER_IMAGE_COUNT_KEY = "user-image-count";

export const USER_IMAGE_CAP = 100;

// Signed URLs expire in 1hr — refetch after 50min so they never go stale in-use
const SIGNED_URL_STALE_MS = 50 * 60 * 1000;

export function useClimbImages(climbId: string) {
	return useQuery({
		queryKey: [CLIMB_IMAGES_KEY, climbId],
		queryFn: () => fetchClimbImages(climbId),
		staleTime: SIGNED_URL_STALE_MS,
		enabled: !!climbId,
	});
}

export function useUserImageCount() {
	const userId = useAuthStore((s) => s.user?.id);
	return useQuery({
		queryKey: [USER_IMAGE_COUNT_KEY, userId],
		queryFn: () => getUserImageCount(userId ?? ""),
		enabled: !!userId,
	});
}

export function useAddClimbImage(climbId: string) {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id);
	const addToast = useUiStore((s) => s.addToast);

	return useMutation({
		mutationFn: async (file: File) => {
			if (!userId) throw new Error("Not authenticated");

			const count = await getUserImageCount(userId);
			if (count >= USER_IMAGE_CAP) {
				throw new Error(`Image cap reached (${USER_IMAGE_CAP} photos max)`);
			}

			const sortOrder = await getClimbImageSortOrder(climbId);
			const imageId = crypto.randomUUID();
			const storagePath = `${userId}/${climbId}/${imageId}.jpg`;

			await uploadToStorage("climb-images", storagePath, file);
			await insertClimbImage(climbId, userId, storagePath, sortOrder);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [CLIMB_IMAGES_KEY, climbId] });
			qc.invalidateQueries({ queryKey: [USER_IMAGE_COUNT_KEY, userId] });
		},
		onError: (err) => {
			addToast({
				message: err instanceof Error ? err.message : "Failed to upload photo",
				type: "error",
			});
		},
	});
}

export function useDeleteClimbImage(climbId: string) {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id);

	return useMutation({
		mutationFn: async ({
			id,
			storagePath,
		}: {
			id: string;
			storagePath: string;
		}) => {
			await softDeleteClimbImage(id);
			await supabase.storage.from("climb-images").remove([storagePath]);
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [CLIMB_IMAGES_KEY, climbId] });
			qc.invalidateQueries({ queryKey: [USER_IMAGE_COUNT_KEY, userId] });
		},
	});
}

export function useReorderClimbImages(climbId: string) {
	const qc = useQueryClient();

	return useMutation({
		mutationFn: (ids: string[]) => reorderClimbImages(ids),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [CLIMB_IMAGES_KEY, climbId] });
		},
	});
}

// ── Pins ──────────────────────────────────────────────────────────────────────

export function useClimbImagePins(climbImageId: string | null) {
	return useQuery({
		queryKey: [CLIMB_IMAGE_PINS_KEY, climbImageId],
		queryFn: () => fetchClimbImagePins(climbImageId ?? ""),
		enabled: !!climbImageId,
	});
}

export function useAddPin(climbImageId: string) {
	const qc = useQueryClient();

	return useMutation({
		mutationFn: async ({
			pinType,
			xPct,
			yPct,
		}: {
			pinType: PinType;
			xPct: number;
			yPct: number;
		}) => {
			const existing = await fetchClimbImagePins(climbImageId);
			await insertClimbImagePin(
				climbImageId,
				pinType,
				xPct,
				yPct,
				existing.length,
			);
		},
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: [CLIMB_IMAGE_PINS_KEY, climbImageId],
			});
		},
	});
}

export function useUpdatePin(climbImageId: string) {
	const qc = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			patch,
		}: {
			id: string;
			patch: { x_pct?: number; y_pct?: number; description?: string | null };
		}) => updateClimbImagePin(id, patch),
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: [CLIMB_IMAGE_PINS_KEY, climbImageId],
			});
		},
	});
}

export function useDeletePin(climbImageId: string) {
	const qc = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => deleteClimbImagePin(id),
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: [CLIMB_IMAGE_PINS_KEY, climbImageId],
			});
		},
	});
}
