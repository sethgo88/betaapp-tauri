import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	adminAddCountry,
	adminAddRegion,
	adminDeleteCountry,
	adminDeleteRegion,
	downloadRegion,
	fetchCountries,
	fetchCrags,
	fetchDownloadedRegionIds,
	fetchRegions,
	fetchSubRegions,
	fetchWalls,
	pullCountries,
	pullRegions,
} from "./locations.service";

export function useCountries() {
	return useQuery({
		queryKey: ["countries"],
		queryFn: fetchCountries,
	});
}

export function useRegions(countryId: string | null) {
	return useQuery({
		queryKey: ["regions", countryId],
		queryFn: () => fetchRegions(countryId ?? ""),
		enabled: !!countryId,
	});
}

export function useSubRegions(regionId: string | null) {
	return useQuery({
		queryKey: ["sub_regions", regionId],
		queryFn: () => fetchSubRegions(regionId ?? ""),
		enabled: !!regionId,
	});
}

export function useCrags(subRegionId: string | null) {
	return useQuery({
		queryKey: ["crags", subRegionId],
		queryFn: () => fetchCrags(subRegionId ?? ""),
		enabled: !!subRegionId,
	});
}

export function useWalls(cragId: string | null) {
	return useQuery({
		queryKey: ["walls", cragId],
		queryFn: () => fetchWalls(cragId ?? ""),
		enabled: !!cragId,
	});
}

export function useDownloadedRegionIds() {
	return useQuery({
		queryKey: ["downloaded_regions"],
		queryFn: fetchDownloadedRegionIds,
	});
}

export function useDownloadRegion() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (regionId: string) => downloadRegion(regionId),
		onSuccess: (_data, regionId) => {
			qc.invalidateQueries({ queryKey: ["downloaded_regions"] });
			qc.invalidateQueries({ queryKey: ["sub_regions", regionId] });
		},
	});
}

// ── Admin mutations ───────────────────────────────────────────────────────────

export function useAdminAddCountry() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			name,
			code,
			sortOrder,
		}: {
			name: string;
			code: string;
			sortOrder: number;
		}) => adminAddCountry(name, code, sortOrder),
		onSuccess: async () => {
			await pullCountries();
			qc.invalidateQueries({ queryKey: ["countries"] });
		},
	});
}

export function useAdminDeleteCountry() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => adminDeleteCountry(id),
		onSuccess: async () => {
			await pullCountries();
			qc.invalidateQueries({ queryKey: ["countries"] });
		},
	});
}

export function useAdminAddRegion() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			countryId,
			name,
			sortOrder,
		}: {
			countryId: string;
			name: string;
			sortOrder: number;
		}) => adminAddRegion(countryId, name, sortOrder),
		onSuccess: async (_data, { countryId }) => {
			await pullRegions();
			qc.invalidateQueries({ queryKey: ["regions", countryId] });
		},
	});
}

export function useAdminDeleteRegion() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id }: { id: string; countryId: string }) =>
			adminDeleteRegion(id),
		onSuccess: async (_data, { countryId }) => {
			await pullRegions();
			qc.invalidateQueries({ queryKey: ["regions", countryId] });
		},
	});
}
