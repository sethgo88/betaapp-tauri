import { CheckCircle, Loader2, WifiOff } from "lucide-react";
import { useSyncStore } from "@/features/sync/sync.store";

export const SyncStatus = () => {
	const status = useSyncStore((s) => s.status);
	const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);

	// Don't show anything until a sync has been attempted
	if (status === "idle" && !lastSyncedAt) return null;

	if (status === "syncing") {
		return <Loader2 size={12} className="animate-spin text-text-secondary" />;
	}
	if (status === "error") {
		return <WifiOff size={12} className="text-red-400" />;
	}
	return <CheckCircle size={12} className="text-accent-primary" />;
};
