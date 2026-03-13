import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import { pushBurns } from "@/features/sync/sync.service";
import { useUiStore } from "@/stores/ui.store";
import type { BurnFormValues } from "./burns.schema";
import {
	fetchBurns,
	insertBurn,
	softDeleteBurn,
	updateBurn,
} from "./burns.service";

const BURNS_KEY = "burns";

const silentPush = (userId: string | undefined) => {
	if (!userId) return;
	const { addToast } = useUiStore.getState();
	pushBurns(userId)
		.then(() => addToast({ message: "Synced", type: "success" }))
		.catch(() =>
			addToast({ message: "Sync failed — saved offline", type: "error" }),
		);
};

export function useBurns(climbId: string) {
	return useQuery({
		queryKey: [BURNS_KEY, climbId],
		queryFn: () => fetchBurns(climbId),
		enabled: !!climbId,
	});
}

export function useAddBurn() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id);
	return useMutation({
		mutationFn: ({
			climbId,
			data,
		}: {
			climbId: string;
			data: BurnFormValues;
		}) => insertBurn(climbId, userId ?? "", data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [BURNS_KEY] });
			silentPush(userId);
		},
	});
}

export function useUpdateBurn() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id);
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: BurnFormValues }) =>
			updateBurn(id, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [BURNS_KEY] });
			silentPush(userId);
		},
	});
}

export function useDeleteBurn() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id);
	return useMutation({
		mutationFn: (id: string) => softDeleteBurn(id),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [BURNS_KEY] });
			silentPush(userId);
		},
	});
}
