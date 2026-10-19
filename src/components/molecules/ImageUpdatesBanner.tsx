import { useNavigate } from "@tanstack/react-router";
import { isTauri } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import { useImageUpdateCount } from "@/features/image-downloads/image-downloads.queries";
import { useImageDownloadStore } from "@/features/image-downloads/image-downloads.store";

/** App-wide notice that downloaded areas have newer images. Dismissed until next launch. */
export function ImageUpdatesBanner() {
	const navigate = useNavigate();
	const count = useImageUpdateCount();
	const dismissed = useImageDownloadStore((s) => s.updatesBannerDismissed);
	const dismiss = useImageDownloadStore((s) => s.dismissUpdatesBanner);

	if (!isTauri() || dismissed || count === 0) return null;

	return (
		<output className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-amber-900/30 border border-amber-700/40 px-4 py-3 text-sm">
			<span className="text-amber-300">
				Newer images are available for {count} downloaded{" "}
				{count === 1 ? "area" : "areas"}.
			</span>
			<div className="flex items-center gap-2 shrink-0">
				<button
					type="button"
					onClick={() => navigate({ to: "/settings/images" })}
					className="font-semibold text-amber-300 underline"
				>
					Review
				</button>
				<button
					type="button"
					onClick={dismiss}
					aria-label="Dismiss"
					className="text-amber-300"
				>
					<X size={16} />
				</button>
			</div>
		</output>
	);
}
