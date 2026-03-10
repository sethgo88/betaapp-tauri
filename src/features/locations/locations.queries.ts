import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import type {
	CragSubmitValues,
	SubRegionSubmitValues,
	WallSubmitValues,
} from "./locations.schema";
import {
	adminAddCountry,
	adminAddRegion,
	adminDeleteCountry,
	adminDeleteRegion,
	downloadRegion,
	fetchCountries,
	fetchCrags,
	fetchDownloadedRegionIds,
	fetchPendingLocations,
	fetchRegions,
	fetchSubRegions,
	fetchWalls,
	pullCountries,
	pullRegions,
	rejectLocation,
	submitCrag,
	submitSubRegion,
	submitWall,
	verifyLocation,
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

// ── User submission mutations ─────────────────────────────────────────────────

export function useSubmitSubRegion() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id ?? "");
	return useMutation({
		mutationFn: (values: SubRegionSubmitValues) =>
			submitSubRegion(values, userId),
		onSuccess: (_data, values) => {
			qc.invalidateQueries({ queryKey: ["sub_regions", values.region_id] });
		},
	});
}

export function useSubmitCrag() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id ?? "");
	return useMutation({
		mutationFn: (values: CragSubmitValues) => submitCrag(values, userId),
		onSuccess: (_data, values) => {
			qc.invalidateQueries({
				queryKey: ["crags", values.sub_region_id],
			});
		},
	});
}

export function useSubmitWall() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id ?? "");
	return useMutation({
		mutationFn: (values: WallSubmitValues) => submitWall(values, userId),
		onSuccess: (_data, values) => {
			qc.invalidateQueries({ queryKey: ["walls", values.crag_id] });
		},
	});
}

// ── Admin location verification ───────────────────────────────────────────────

export function usePendingLocations() {
	return useQuery({
		queryKey: ["pending_locations"],
		queryFn: fetchPendingLocations,
	});
}

export function useVerifyLocation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			table,
			id,
		}: {
			table: "sub_regions" | "crags" | "walls";
			id: string;
		}) => verifyLocation(table, id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["pending_locations"] });
		},
	});
}

export function useRejectLocation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			table,
			id,
		}: {
			table: "sub_regions" | "crags" | "walls";
			id: string;
		}) => rejectLocation(table, id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["pending_locations"] });
		},
	});
}
