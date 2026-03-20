import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/auth.store";
import { pushClimbs } from "@/features/sync/sync.service";
import { useUiStore } from "@/stores/ui.store";
import type { ClimbFormValues } from "./climbs.schema";
import {
	fetchClimb,
	fetchClimbs,
	insertClimb,
	linkClimbToRoute,
	softDeleteClimb,
	updateClimb,
	updateClimbMoves,
} from "./climbs.service";
import { useClimbsStore } from "./climbs.store";

const CLIMBS_KEY = "climbs";

export function useClimbs() {
	const userId = useAuthStore((s) => s.user?.id);
	const sortKey = useClimbsStore((s) => s.sortKey);
	return useQuery({
		queryKey: [CLIMBS_KEY, userId, sortKey],
		queryFn: () => fetchClimbs(userId ?? "", sortKey),
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
		mutationFn: ({
			data,
			routeId,
		}: {
			data: ClimbFormValues;
			routeId?: string;
		}) => insertClimb(userId ?? "", data, routeId),
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
		mutationFn: ({
			id,
			data,
			routeId,
		}: {
			id: string;
			data: ClimbFormValues;
			routeId?: string | null;
		}) => updateClimb(id, data, routeId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [CLIMBS_KEY] });
			silentPush(userId);
		},
	});
}

export function useLinkClimbToRoute() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id);
	return useMutation({
		mutationFn: ({ climbId, routeId }: { climbId: string; routeId: string }) =>
			linkClimbToRoute(climbId, routeId),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: [CLIMBS_KEY] });
			silentPush(userId);
		},
	});
}

export function useUpdateClimbMoves() {
	const qc = useQueryClient();
	const userId = useAuthStore((s) => s.user?.id);
	return useMutation({
		mutationFn: ({ id, moves }: { id: string; moves: string }) =>
			updateClimbMoves(id, moves),
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
