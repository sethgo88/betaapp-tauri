import { useQuery } from "@tanstack/react-query";
import { fetchCountries, fetchRegions } from "./locations.service";

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
