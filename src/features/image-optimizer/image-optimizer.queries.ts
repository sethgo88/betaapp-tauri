import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CACHED_IMAGE_KEY } from "@/features/image-cache/image-cache.queries";
import {
	type OptimizePlan,
	type OptimizeProgress,
	type OptimizeSummary,
	runOptimization,
	scanImages,
	supabaseBackend,
} from "./image-optimizer.service";

export function useScanImages() {
	return useMutation<OptimizePlan, Error>({ mutationFn: () => scanImages() });
}

export function useRunImageOptimization() {
	const qc = useQueryClient();
	return useMutation<
		OptimizeSummary,
		Error,
		{ signal: AbortSignal; onProgress: (p: OptimizeProgress) => void }
	>({
		mutationFn: ({ signal, onProgress }) =>
			runOptimization(supabaseBackend, { signal, onProgress }),
		onSettled: () => {
			qc.invalidateQueries({ queryKey: ["route-images"] });
			qc.invalidateQueries({ queryKey: ["wall-images"] });
			qc.invalidateQueries({ queryKey: ["wall-topo"] });
			qc.invalidateQueries({ queryKey: ["route-topo"] });
			qc.invalidateQueries({ queryKey: ["climb-images"] });
			qc.invalidateQueries({ queryKey: ["image-downloads"] });
			qc.invalidateQueries({ queryKey: [CACHED_IMAGE_KEY] });
		},
	});
}
