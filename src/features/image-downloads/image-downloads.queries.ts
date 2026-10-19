import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CACHED_IMAGE_KEY } from "@/features/image-cache/image-cache.queries";
import { useUiStore } from "@/stores/ui.store";
import type { ScopeSummary, ScopeType } from "./image-downloads.schema";
import {
	deleteScopeImages,
	downloadScopeImages,
	fetchImageDownload,
	fetchImageDownloads,
	getScopeSummary,
} from "./image-downloads.service";
import { useImageDownloadStore } from "./image-downloads.store";

export const IMAGE_DOWNLOADS_KEY = "image-downloads";

export function useImageDownloads() {
	return useQuery({
		queryKey: [IMAGE_DOWNLOADS_KEY],
		queryFn: fetchImageDownloads,
		networkMode: "offlineFirst",
	});
}

export function useImageDownloadRecord(type: ScopeType, id: string) {
	return useQuery({
		queryKey: [IMAGE_DOWNLOADS_KEY, type, id],
		queryFn: () => fetchImageDownload(type, id),
		networkMode: "offlineFirst",
	});
}

/** Counts/sizes for the confirmation dialog — computed from local data only. */
export function useScopeSummary() {
	return useMutation<ScopeSummary, Error, { type: ScopeType; id: string }>({
		mutationFn: ({ type, id }) => getScopeSummary(type, id),
	});
}

export function useStartImageDownload() {
	const qc = useQueryClient();
	const addToast = useUiStore((s) => s.addToast);
	const { begin, setProgress, finish } = useImageDownloadStore();

	return useMutation({
		mutationFn: async ({ type, id }: { type: ScopeType; id: string }) => {
			if (useImageDownloadStore.getState().active) {
				throw new Error("Another image download is already running");
			}
			const controller = begin(type, id);
			try {
				return await downloadScopeImages(type, id, {
					signal: controller.signal,
					onProgress: setProgress,
				});
			} finally {
				finish();
			}
		},
		onSuccess: (result) => {
			if (result.cancelled) {
				addToast({ message: "Image download paused", type: "warning" });
			} else if (result.failed > 0) {
				addToast({
					message: `${result.failed} images failed — tap Resume to retry`,
					type: "warning",
				});
			} else {
				addToast({ message: "Images downloaded for offline", type: "success" });
			}
		},
		onError: (err) => {
			addToast({
				message: err instanceof Error ? err.message : "Image download failed",
				type: "error",
			});
		},
		onSettled: () => {
			qc.invalidateQueries({ queryKey: [IMAGE_DOWNLOADS_KEY] });
			qc.invalidateQueries({ queryKey: [CACHED_IMAGE_KEY] });
			qc.invalidateQueries({ queryKey: ["downloaded_regions"] });
		},
	});
}

export function useDeleteImageDownload() {
	const qc = useQueryClient();
	const addToast = useUiStore((s) => s.addToast);

	return useMutation({
		mutationFn: ({ type, id }: { type: ScopeType; id: string }) =>
			deleteScopeImages(type, id),
		onSuccess: () => {
			addToast({ message: "Downloaded images removed", type: "success" });
			qc.invalidateQueries({ queryKey: [IMAGE_DOWNLOADS_KEY] });
			qc.invalidateQueries({ queryKey: [CACHED_IMAGE_KEY] });
		},
		onError: () => {
			addToast({ message: "Failed to remove images", type: "error" });
		},
	});
}
