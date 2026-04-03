import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import type {
	CragSubmitValues,
	SubRegionSubmitValues,
	WallSubmitValues,
} from "./locations.schema";
import {
	adminAddCountry,
	adminAddCrag,
	adminAddRegion,
	adminAddSubRegion,
	adminAddWall,
	adminDeleteCountry,
	adminDeleteCrag,
	adminDeleteRegion,
	adminDeleteSubRegion,
	adminDeleteWall,
	adminMoveCrag,
	adminMoveWall,
	adminRenameLocation,
	adminUpdateCragCoords,
	adminUpdateWallCoords,
	adminUpdateWallType,
	checkRegionStaleness,
	downloadRegion,
	fetchAllCragsWithCoords,
	fetchAllWallsWithCoords,
	fetchCountries,
	fetchCrag,
	fetchCrags,
	fetchDownloadedRegionIds,
	fetchPendingLocations,
	fetchRegion,
	fetchRegions,
	fetchSubRegion,
	fetchSubRegions,
	fetchWall,
	fetchWalls,
	pullCountries,
	pullRegions,
	rejectLocation,
	searchLocations,
	submitCrag,
	submitSubRegion,
	submitWall,
	updateLocationApproach,
	updateLocationDescription,
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

// ── Single-entity hooks ───────────────────────────────────────────────────────

export function useRegion(id: string | null) {
	return useQuery({
		queryKey: ["region", id],
		queryFn: () => fetchRegion(id ?? ""),
		enabled: !!id,
	});
}

export function useSubRegion(id: string | null) {
	return useQuery({
		queryKey: ["sub_region", id],
		queryFn: () => fetchSubRegion(id ?? ""),
		enabled: !!id,
	});
}

export function useCrag(id: string | null) {
	return useQuery({
		queryKey: ["crag", id],
		queryFn: () => fetchCrag(id ?? ""),
		enabled: !!id,
	});
}

export function useWall(id: string | null) {
	return useQuery({
		queryKey: ["wall", id],
		queryFn: () => fetchWall(id ?? ""),
		enabled: !!id,
	});
}

export function useUpdateLocationDescription() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			table,
			id,
			description,
		}: {
			table: "sub_regions" | "crags" | "walls";
			id: string;
			description: string;
		}) => updateLocationDescription(table, id, description),
		onSuccess: (_data, { table, id }) => {
			const keyMap = {
				sub_regions: "sub_region",
				crags: "crag",
				walls: "wall",
			} as const;
			qc.invalidateQueries({ queryKey: [keyMap[table], id] });
		},
	});
}

export function useUpdateLocationApproach() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			table,
			id,
			approach,
		}: {
			table: "crags" | "walls";
			id: string;
			approach: string;
		}) => updateLocationApproach(table, id, approach),
		onSuccess: (_data, { table, id }) => {
			const keyMap = { crags: "crag", walls: "wall" } as const;
			qc.invalidateQueries({ queryKey: [keyMap[table], id] });
			qc.invalidateQueries({ queryKey: ["crags_with_coords"] });
			qc.invalidateQueries({ queryKey: ["walls_with_coords"] });
		},
	});
}

export function useSearchLocations(
	query: string,
	stopAt: "sub_region" | "crag" | "wall" = "wall",
	enabled = true,
) {
	return useQuery({
		queryKey: ["search_locations", query, stopAt],
		queryFn: () => searchLocations(query, stopAt),
		enabled: enabled && query.length >= 2,
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

// ── Admin rename/delete mutations ─────────────────────────────────────────────

export function useAdminRenameLocation() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			table,
			id,
			name,
		}: {
			table: "sub_regions" | "crags" | "walls";
			id: string;
			name: string;
			parentId: string;
		}) => adminRenameLocation(table, id, name),
		onSuccess: (_data, { table, id, parentId }) => {
			const singleKeyMap = {
				sub_regions: "sub_region",
				crags: "crag",
				walls: "wall",
			} as const;
			const listKeyMap = {
				sub_regions: "sub_regions",
				crags: "crags",
				walls: "walls",
			} as const;
			qc.invalidateQueries({ queryKey: [singleKeyMap[table], id] });
			qc.invalidateQueries({ queryKey: [listKeyMap[table], parentId] });
		},
	});
}

export function useAdminDeleteSubRegion() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id }: { id: string; regionId: string }) =>
			adminDeleteSubRegion(id),
		onSuccess: (_data, { regionId }) => {
			qc.invalidateQueries({ queryKey: ["sub_regions", regionId] });
		},
	});
}

export function useAdminDeleteCrag() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id }: { id: string; subRegionId: string }) =>
			adminDeleteCrag(id),
		onSuccess: (_data, { subRegionId }) => {
			qc.invalidateQueries({ queryKey: ["crags", subRegionId] });
		},
	});
}

export function useAdminDeleteWall() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id }: { id: string; cragId: string }) => adminDeleteWall(id),
		onSuccess: (_data, { cragId }) => {
			qc.invalidateQueries({ queryKey: ["walls", cragId] });
		},
	});
}

// ── Admin move mutations ──────────────────────────────────────────────────────

export function useAdminMoveCrag() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			cragId,
			newSubRegionId,
		}: {
			cragId: string;
			newSubRegionId: string;
			oldSubRegionId: string;
		}) => adminMoveCrag(cragId, newSubRegionId),
		onSuccess: (_data, { newSubRegionId, oldSubRegionId }) => {
			qc.invalidateQueries({ queryKey: ["crags", oldSubRegionId] });
			qc.invalidateQueries({ queryKey: ["crags", newSubRegionId] });
			qc.invalidateQueries({ queryKey: ["crag"] });
		},
	});
}

export function useAdminMoveWall() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			wallId,
			newCragId,
		}: {
			wallId: string;
			newCragId: string;
			oldCragId: string;
		}) => adminMoveWall(wallId, newCragId),
		onSuccess: (_data, { newCragId, oldCragId }) => {
			qc.invalidateQueries({ queryKey: ["walls", oldCragId] });
			qc.invalidateQueries({ queryKey: ["walls", newCragId] });
			qc.invalidateQueries({ queryKey: ["wall"] });
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
			code?: string;
			sortOrder?: number;
		}) => adminAddCountry(name, code, sortOrder),
		onSuccess: () => {
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
			sortOrder?: number;
		}) => adminAddRegion(countryId, name, sortOrder),
		onSuccess: (_data, { countryId }) => {
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
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");
	return useMutation({
		mutationFn: (values: SubRegionSubmitValues) =>
			submitSubRegion(values, userId, isAdmin),
		onSuccess: (_data, values) => {
			qc.invalidateQueries({ queryKey: ["sub_regions", values.region_id] });
		},
	});
}

export function useSubmitCrag() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id ?? "");
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");
	return useMutation({
		mutationFn: (values: CragSubmitValues) =>
			submitCrag(values, userId, isAdmin),
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
	const isAdmin = useAuthStore((s) => s.user?.role === "admin");
	return useMutation({
		mutationFn: (values: WallSubmitValues) =>
			submitWall(values, userId, isAdmin),
		onSuccess: (_data, values) => {
			qc.invalidateQueries({ queryKey: ["walls", values.crag_id] });
		},
	});
}

// ── Admin location add mutations ──────────────────────────────────────────────

export function useAdminAddSubRegion() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id ?? "");
	return useMutation({
		mutationFn: (values: SubRegionSubmitValues) =>
			adminAddSubRegion(values, userId),
		onSuccess: (_data, values) => {
			qc.invalidateQueries({ queryKey: ["sub_regions", values.region_id] });
		},
	});
}

export function useAdminAddCrag() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id ?? "");
	return useMutation({
		mutationFn: (values: CragSubmitValues) => adminAddCrag(values, userId),
		onSuccess: (_data, values) => {
			qc.invalidateQueries({
				queryKey: ["crags", values.sub_region_id],
			});
		},
	});
}

export function useAdminAddWall() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id ?? "");
	return useMutation({
		mutationFn: (values: WallSubmitValues) => adminAddWall(values, userId),
		onSuccess: (_data, values) => {
			qc.invalidateQueries({ queryKey: ["walls", values.crag_id] });
		},
	});
}

// ── Map hooks ────────────────────────────────────────────────────────────────

export function useAllCragsWithCoords() {
	return useQuery({
		queryKey: ["crags_with_coords"],
		queryFn: fetchAllCragsWithCoords,
	});
}

export function useAdminUpdateCragCoords() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			lat,
			lng,
		}: {
			id: string;
			lat: number | null;
			lng: number | null;
		}) => adminUpdateCragCoords(id, lat, lng),
		onSuccess: (_data, { id }) => {
			qc.invalidateQueries({ queryKey: ["crag", id] });
			qc.invalidateQueries({ queryKey: ["crags_with_coords"] });
		},
	});
}

export function useAllWallsWithCoords() {
	return useQuery({
		queryKey: ["walls_with_coords"],
		queryFn: fetchAllWallsWithCoords,
	});
}

export function useAdminUpdateWallType() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, wallType }: { id: string; wallType: string }) =>
			adminUpdateWallType(id, wallType),
		onSuccess: (_data, { id }) => {
			qc.invalidateQueries({ queryKey: ["wall", id] });
			qc.invalidateQueries({ queryKey: ["walls_with_coords"] });
		},
	});
}

export function useAdminUpdateWallCoords() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			lat,
			lng,
			cragId,
		}: {
			id: string;
			lat: number;
			lng: number;
			cragId: string;
		}) => adminUpdateWallCoords(id, lat, lng, cragId),
		onSuccess: (_data, { id, cragId }) => {
			qc.invalidateQueries({ queryKey: ["wall", id] });
			qc.invalidateQueries({ queryKey: ["walls_with_coords"] });
			qc.invalidateQueries({ queryKey: ["crag", cragId] });
			qc.invalidateQueries({ queryKey: ["crags_with_coords"] });
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

export function useStaleRegionIds() {
	return useQuery({
		queryKey: ["stale_region_ids"],
		queryFn: checkRegionStaleness,
		// Don't auto-refetch — staleness is checked explicitly on app launch
		staleTime: Number.POSITIVE_INFINITY,
	});
}
