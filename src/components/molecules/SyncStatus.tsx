import { AlertCircle, CheckCircle, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { useSyncStore } from "@/features/sync/sync.store";

export const SyncStatus = () => {
	const status = useSyncStore((s) => s.status);
	const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
	const triggerSync = useSyncStore((s) => s.triggerSync);

	// Don't show anything until a sync has been attempted
	if (status === "idle" && !lastSyncedAt) return null;

	const retryButton = (
		<button
			type="button"
			onClick={() => triggerSync?.()}
			className="ml-1 text-text-secondary active:opacity-60"
			aria-label="Retry sync"
		>
			<RefreshCw size={12} />
		</button>
	);

	if (status === "syncing") {
		return <Loader2 size={12} className="animate-spin text-text-secondary" />;
	}
	if (status === "offline") {
		return (
			<span className="flex items-center">
				<WifiOff size={12} className="text-text-muted" />
				{retryButton}
			</span>
		);
	}
	if (status === "error") {
		return (
			<span className="flex items-center">
				<AlertCircle size={12} className="text-red-400" />
				{retryButton}
			</span>
		);
	}
	return <CheckCircle size={12} className="text-accent-primary" />;
};
