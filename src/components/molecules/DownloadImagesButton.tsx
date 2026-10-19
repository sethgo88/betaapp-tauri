import { isTauri } from "@tauri-apps/api/core";
import { Download, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import {
	useDeleteImageDownload,
	useImageDownloadRecord,
	useScopeSummary,
	useStartImageDownload,
} from "@/features/image-downloads/image-downloads.queries";
import type {
	ScopeSummary,
	ScopeType,
} from "@/features/image-downloads/image-downloads.schema";
import { useImageDownloadStore } from "@/features/image-downloads/image-downloads.store";
import { formatBytes } from "@/lib/format";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

interface DownloadImagesButtonProps {
	scopeType: ScopeType;
	scopeId: string;
	className?: string;
}

function describe(summary: ScopeSummary): string {
	if (summary.regionDataMissing) {
		return `The data for ${summary.regionName ?? "this region"} isn't on this device yet. It will be downloaded first, then all images in ${summary.areaName} and everything under it.`;
	}
	const removal =
		summary.toRemove > 0
			? ` ${summary.toRemove} image${summary.toRemove === 1 ? "" : "s"} that ${summary.toRemove === 1 ? "was" : "were"} removed from the area will be deleted from this device.`
			: "";
	if (summary.toDownload === 0) {
		return `All ${summary.total} images in ${summary.areaName} are already on this device.${removal}`;
	}
	const known =
		summary.knownBytes > 0 ? `${formatBytes(summary.knownBytes)} known` : null;
	const unknown =
		summary.unknownCount > 0 ? `${summary.unknownCount} of unknown size` : null;
	const size = [known, unknown].filter(Boolean).join(", ");
	return `${summary.toDownload} image${summary.toDownload === 1 ? "" : "s"} in ${summary.areaName} and everything under it will be downloaded${size ? ` (${size})` : ""}.${removal}`;
}

/** Download / resume / re-fetch / remove offline images for an area and its children. */
export function DownloadImagesButton({
	scopeType,
	scopeId,
	className,
}: DownloadImagesButtonProps) {
	const { data: record } = useImageDownloadRecord(scopeType, scopeId);
	const active = useImageDownloadStore((s) => s.active);
	const summaryMutation = useScopeSummary();
	const startDownload = useStartImageDownload();
	const deleteDownload = useDeleteImageDownload();
	const [summary, setSummary] = useState<ScopeSummary | null>(null);
	const [confirmRemove, setConfirmRemove] = useState(false);

	if (!isTauri()) return null;

	const isThisActive = active?.type === scopeType && active.id === scopeId;
	const isOtherActive = !!active && !isThisActive;

	const openConfirm = () =>
		summaryMutation.mutate(
			{ type: scopeType, id: scopeId },
			{ onSuccess: setSummary },
		);

	if (isThisActive) {
		return (
			<div className={className}>
				<Button
					variant="outlined"
					size="small"
					onClick={() => active.controller.abort()}
					aria-label="Cancel image download"
				>
					{active.preparing
						? "Preparing… Cancel"
						: `Downloading ${active.done}/${active.total} · Cancel`}
				</Button>
			</div>
		);
	}

	const isComplete = record?.status === "complete";
	const isPartial = record?.status === "partial";

	return (
		<div className={className}>
			<div className="flex flex-wrap items-center gap-2">
				{isComplete ? (
					<>
						<span className="text-xs text-white">
							Images saved offline ({record.image_count})
						</span>
						<Button
							variant="outlined"
							size="small"
							onClick={openConfirm}
							disabled={isOtherActive || summaryMutation.isPending}
							aria-label="Re-fetch images"
						>
							<RefreshCw size={14} className="inline mr-1" />
							Re-fetch
						</Button>
						<Button
							variant="outlined"
							size="small"
							onClick={() => setConfirmRemove(true)}
							aria-label="Remove downloaded images"
						>
							<Trash2 size={14} className="inline mr-1" />
							Remove
						</Button>
					</>
				) : (
					<Button
						variant="outlined"
						size="small"
						onClick={openConfirm}
						disabled={isOtherActive || summaryMutation.isPending}
					>
						<Download size={14} className="inline mr-1" />
						{isPartial ? "Resume image download" : "Download images"}
					</Button>
				)}
			</div>

			<ConfirmDeleteDialog
				isOpen={!!summary}
				title="Download images for offline"
				message={summary ? describe(summary) : ""}
				confirmLabel="Download"
				onCancel={() => setSummary(null)}
				onConfirm={() => {
					setSummary(null);
					startDownload.mutate({ type: scopeType, id: scopeId });
				}}
			/>
			<ConfirmDeleteDialog
				isOpen={confirmRemove}
				title="Delete downloaded images"
				message={`The downloaded images for ${record?.name ?? "this area"} will be removed from this device. Images shared with other downloaded areas are kept.`}
				onCancel={() => setConfirmRemove(false)}
				onConfirm={() => {
					setConfirmRemove(false);
					deleteDownload.mutate({ type: scopeType, id: scopeId });
				}}
			/>
		</div>
	);
}
