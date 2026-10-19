import { useNavigate } from "@tanstack/react-router";
import { isTauri } from "@tauri-apps/api/core";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useStorageOverview } from "@/features/image-downloads/image-downloads.queries";
import { formatBytes } from "@/lib/format";

export const DEBUG_OFFLINE_FLAG = "betaapp-debug-offline";

const DevOfflineToggle = () => {
	const [enabled, setEnabled] = useState(
		() => !!localStorage.getItem(DEBUG_OFFLINE_FLAG),
	);

	const toggle = () => {
		const next = !enabled;
		if (next) {
			localStorage.setItem(DEBUG_OFFLINE_FLAG, "1");
		} else {
			localStorage.removeItem(DEBUG_OFFLINE_FLAG);
		}
		setEnabled(next);
	};

	return (
		<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-3">
			<p className="text-xs text-text-on-light uppercase tracking-wide">
				Developer
			</p>
			<div className="flex items-center justify-between">
				<div>
					<p className="text-sm font-medium">Simulate offline startup</p>
					<p className="text-xs text-text-on-light mt-0.5">
						Treats the app as offline on next cold start. Restart to apply.
					</p>
				</div>
				<button
					type="button"
					onClick={toggle}
					aria-label="Toggle offline simulation"
					aria-pressed={enabled}
					className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
						enabled ? "bg-accent-primary" : "bg-surface-raised"
					}`}
				>
					<span
						className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
							enabled ? "translate-x-6" : "translate-x-1"
						}`}
					/>
				</button>
			</div>
			{enabled && (
				<p className="text-xs text-accent-secondary">
					Offline mode active — restart the app to test session restore.
				</p>
			)}
		</div>
	);
};

const OfflineImagesCard = () => {
	const navigate = useNavigate();
	const { data } = useStorageOverview();

	return (
		<button
			type="button"
			onClick={() => navigate({ to: "/settings/images" })}
			className="rounded-lg bg-surface-card p-4 flex items-center justify-between gap-3 text-left"
		>
			<div>
				<p className="text-sm font-medium text-text-primary">Offline images</p>
				<p className="text-xs text-text-on-light mt-0.5">
					{data?.total.count ?? 0} images ·{" "}
					{formatBytes(data?.total.bytes ?? 0)} on this device
				</p>
			</div>
			<ChevronRight size={18} className="text-text-primary shrink-0" />
		</button>
	);
};

const SettingsView = () => {
	return (
		<div className="flex flex-col gap-4">
			<h1 className="font-display text-xl font-semibold text-white">
				Settings
			</h1>
			{isTauri() && <OfflineImagesCard />}
			<DevOfflineToggle />
		</div>
	);
};

export default SettingsView;
