import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	adminAddCountry,
	adminAddRegion,
	adminDeleteCountry,
	adminDeleteRegion,
	fetchCountries,
	fetchRegions,
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
