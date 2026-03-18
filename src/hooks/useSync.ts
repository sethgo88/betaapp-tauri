import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import type { Burn } from "@/features/burns/burns.schema";
import { applyRemoteBurn } from "@/features/burns/burns.service";
import type { Climb } from "@/features/climbs/climbs.schema";
import { applyRemoteClimb } from "@/features/climbs/climbs.service";
import { pullGrades } from "@/features/grades/grades.service";
import {
	checkRegionStaleness,
	pullCountries,
	pullRegions,
} from "@/features/locations/locations.service";
import {
	getSyncMeta,
	pullBurns,
	pullClimbImagePins,
	pullClimbImages,
	pullClimbs,
	pullRouteImages,
	pullRouteLinks,
	pullWallImages,
	pushBurns,
	pushClimbImagePins,
	pushClimbImages,
	pushClimbs,
	pushRouteLinks,
	setSyncMeta,
} from "@/features/sync/sync.service";
import { useSyncStore } from "@/features/sync/sync.store";
import { supabase } from "@/lib/supabase";

export function useSync(userId: string | undefined) {
	const queryClient = useQueryClient();
	const { setSyncing, setSuccess, setError, setOffline, setTriggerSync } =
		useSyncStore();

	// Delta push/pull if we have a stored timestamp; full sync on first run.
	// Reference data (grades, countries, regions) always does a full pull —
	// it's small and admin-owned so no delta is needed.
	const runSync = useCallback(async () => {
		if (!userId) return;

		if (!navigator.onLine) {
			setOffline();
			return;
		}

		setSyncing();
		try {
			const { last_synced_at } = await getSyncMeta();
			const since = last_synced_at ?? undefined;

			await pushClimbs(userId, since);
			await pullClimbs(userId, since);
			await pushBurns(userId, since);
			await pullBurns(userId, since);
			await pushClimbImages(userId, since);
			await pullClimbImages(userId, since);
			await pushClimbImagePins(userId, since);
			await pullClimbImagePins(userId, since);
			await pullGrades();
			await pullCountries();
			await pullRegions();
			await checkRegionStaleness().then(() => {
				queryClient.invalidateQueries({ queryKey: ["stale_region_ids"] });
			});
			await pullRouteImages(since);
			await pullWallImages(since);
			await pushRouteLinks(userId, since);
			await pullRouteLinks(since);

			const now = new Date().toISOString();
			await setSyncMeta(now);

			queryClient.invalidateQueries({ queryKey: ["climbs"] });
			queryClient.invalidateQueries({ queryKey: ["burns"] });
			queryClient.invalidateQueries({ queryKey: ["climb-images"] });
			queryClient.invalidateQueries({ queryKey: ["climb-image-pins"] });
			queryClient.invalidateQueries({ queryKey: ["grades"] });
			queryClient.invalidateQueries({ queryKey: ["countries"] });
			queryClient.invalidateQueries({ queryKey: ["regions"] });
			queryClient.invalidateQueries({ queryKey: ["route-images"] });
			queryClient.invalidateQueries({ queryKey: ["wall-images"] });
			queryClient.invalidateQueries({ queryKey: ["route_links"] });
			setSuccess();
		} catch (err) {
			console.error("Sync error:", JSON.stringify(err));
			setError(err instanceof Error ? err.message : JSON.stringify(err));
		}
	}, [
		userId,
		setSyncing,
		setSuccess,
		setError,
		setOffline,
		queryClient,
	]);

	// Register triggerSync in the store so SyncStatus can call it without prop drilling.
	useEffect(() => {
		setTriggerSync(runSync);
	}, [runSync, setTriggerSync]);

	useEffect(() => {
		if (!userId) return;

		runSync();

		// Realtime subscription — applies live server changes between manual syncs.
		// Handles INSERT and UPDATE events (soft deletes arrive as UPDATE with deleted_at set).
		const channel = supabase
			.channel("user-realtime")
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
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "burns",
					filter: `user_id=eq.${userId}`,
				},
				async (payload) => {
					if (payload.new && Object.keys(payload.new).length > 0) {
						await applyRemoteBurn(payload.new as Burn);
					}
					queryClient.invalidateQueries({ queryKey: ["burns"] });
				},
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [userId, runSync, queryClient]);
}
