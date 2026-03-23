import { useQuery } from "@tanstack/react-query";
import { fetchGrades } from "./grades.service";

export function useGrades(discipline: "sport" | "boulder" | "trad") {
	return useQuery({
		queryKey: ["grades", discipline],
		queryFn: () => fetchGrades(discipline),
	});
}
