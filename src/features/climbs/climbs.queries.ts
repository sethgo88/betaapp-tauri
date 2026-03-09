import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import { pushClimbs } from "@/features/sync/sync.service";
import { useUiStore } from "@/stores/ui.store";
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

const silentPush = (userId: string | undefined) => {
	if (!userId) return;
	const { addToast } = useUiStore.getState();
	pushClimbs(userId)
		.then(() => addToast({ message: "Synced", type: "success" }))
		.catch(() =>
			addToast({ message: "Sync failed — saved offline", type: "error" }),
		);
};

export function useAddClimb() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id);
	return useMutation({
		mutationFn: (data: ClimbFormValues) => insertClimb(userId ?? "", data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [CLIMBS_KEY] });
			silentPush(userId);
		},
	});
}

export function useUpdateClimb() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id);
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: ClimbFormValues }) =>
			updateClimb(id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [CLIMBS_KEY] });
			silentPush(userId);
		},
	});
}

export function useDeleteClimb() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id);
	return useMutation({
		mutationFn: (id: string) => softDeleteClimb(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [CLIMBS_KEY] });
			silentPush(userId);
		},
	});
}
