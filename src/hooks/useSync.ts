import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Climb } from "@/features/climbs/climbs.schema";
import { applyRemoteClimb } from "@/features/climbs/climbs.service";
import { pullGrades } from "@/features/grades/grades.service";
import { pullClimbs, pushClimbs } from "@/features/sync/sync.service";
import { useSyncStore } from "@/features/sync/sync.store";
import { supabase } from "@/lib/supabase";

export function useSync(userId: string | undefined) {
	const queryClient = useQueryClient();
	const { setSyncing, setSuccess, setError } = useSyncStore();

	useEffect(() => {
		if (!userId) return;

		// Full push → pull on sign-in or reconnect
		const runSync = async () => {
			setSyncing();
			try {
				await pushClimbs(userId);
				await pullClimbs(userId);
				await pullGrades();
				queryClient.invalidateQueries({ queryKey: ["climbs"] });
				queryClient.invalidateQueries({ queryKey: ["grades"] });
				setSuccess();
			} catch (err) {
				console.error("Sync error:", err);
				setError(err instanceof Error ? err.message : "Sync failed");
			}
		};

		runSync();

		// Realtime subscription — apply live changes from other sessions
		const channel = supabase
			.channel("climbs-realtime")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "climbs",
					filter: `user_id=eq.${userId}`,
				},
				async (payload) => {
					if (payload.new && Object.keys(payload.new).length > 0) {
						await applyRemoteClimb(payload.new as Climb);
					}
					queryClient.invalidateQueries({ queryKey: ["climbs"] });
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [userId, setSyncing, setSuccess, setError, queryClient]);
}
