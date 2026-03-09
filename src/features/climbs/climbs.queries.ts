import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import type { ClimbFormValues } from "./climbs.schema";
import {
	fetchClimb,
	fetchClimbs,
	insertClimb,
	softDeleteClimb,
	updateClimb,
} from "./climbs.service";

const CLIMBS_KEY = "climbs";

export function useClimbs() {
	const userId = useAuthStore((s) => s.user?.id);
	return useQuery({
		queryKey: [CLIMBS_KEY, userId],
		queryFn: () => fetchClimbs(userId ?? ""),
		enabled: !!userId,
	});
}

export function useClimb(id: string) {
	return useQuery({
		queryKey: [CLIMBS_KEY, id],
		queryFn: () => fetchClimb(id),
		enabled: !!id,
	});
}

export function useAddClimb() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id);
	return useMutation({
		mutationFn: (data: ClimbFormValues) => insertClimb(userId ?? "", data),
		onSuccess: () => qc.invalidateQueries({ queryKey: [CLIMBS_KEY] }),
	});
}

export function useUpdateClimb() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: ClimbFormValues }) =>
			updateClimb(id, data),
		onSuccess: () => qc.invalidateQueries({ queryKey: [CLIMBS_KEY] }),
	});
}

export function useDeleteClimb() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => softDeleteClimb(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: [CLIMBS_KEY] }),
	});
}
