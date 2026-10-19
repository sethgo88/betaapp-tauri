import { useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { ConfirmDeleteDialog } from "@/components/molecules/ConfirmDeleteDialog";
import {
	useRunImageOptimization,
	useScanImages,
} from "@/features/image-optimizer/image-optimizer.queries";
import type {
	OptimizePlan,
	OptimizeProgress,
	OptimizeSummary,
} from "@/features/image-optimizer/image-optimizer.service";
import { formatBytes } from "@/lib/format";

const ImageOptimizerView = () => {
	const scan = useScanImages();
	const run = useRunImageOptimization();
	const controller = useRef<AbortController | null>(null);
	const [plan, setPlan] = useState<OptimizePlan | null>(null);
	const [progress, setProgress] = useState<OptimizeProgress | null>(null);
	const [summary, setSummary] = useState<OptimizeSummary | null>(null);
	const [confirming, setConfirming] = useState(false);

	const start = () => {
		const ctrl = new AbortController();
		controller.current = ctrl;
		setSummary(null);
		setProgress({ done: 0, total: plan?.toReencode ?? 0 });
		run.mutate(
			{ signal: ctrl.signal, onProgress: setProgress },
			{
				onSuccess: (result) => {
					setSummary(result);
					scan.mutate(undefined, { onSuccess: setPlan });
				},
			},
		);
	};

	const nothingToDo = plan && plan.toReencode + plan.toBackfill === 0;

	return (
		<div className="flex flex-col gap-4">
			<h1 className="font-display text-xl font-semibold text-white">
				Image optimization
			</h1>
			<p className="text-sm text-white">
				Re-encodes legacy JPEG route, wall, topo and your own climb photos as
				small WebP, and records the size of every image so offline download
				sizes are accurate. Images that are already small only get their size
				recorded. Safe to stop and re-run.
			</p>

			<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-3">
				<Button
					variant="outlined"
					size="small"
					className="self-start"
					onClick={() => scan.mutate(undefined, { onSuccess: setPlan })}
					disabled={scan.isPending || run.isPending}
				>
					{scan.isPending ? "Scanning…" : "Scan images"}
				</Button>
				{scan.isError && (
					<p className="text-sm text-red-400">
						Scan failed: {scan.error.message}
					</p>
				)}
				{plan && (
					<ul className="text-sm text-text-primary">
						<li>{plan.total} images found</li>
						<li>{plan.toReencode} to re-encode as WebP</li>
						<li>{plan.toBackfill} need only a size recorded</li>
						<li>{plan.upToDate} already up to date</li>
					</ul>
				)}
				{plan && !nothingToDo && !run.isPending && (
					<Button onClick={() => setConfirming(true)}>
						Start optimization
					</Button>
				)}
				{nothingToDo && (
					<p className="text-sm text-accent-primary">
						Everything is optimized.
					</p>
				)}
			</div>

			{run.isPending && progress && (
				<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-2">
					<p className="text-sm text-text-primary">
						Processing {progress.done} / {progress.total}
					</p>
					<progress
						className="w-full"
						value={progress.done}
						max={Math.max(progress.total, 1)}
					/>
					<Button
						variant="outlined"
						size="small"
						className="self-start"
						onClick={() => controller.current?.abort()}
					>
						Cancel
					</Button>
				</div>
			)}

			{run.isError && (
				<p className="text-sm text-red-400">{run.error.message}</p>
			)}

			{summary && (
				<div className="rounded-lg bg-surface-card p-4 text-sm text-text-primary flex flex-col gap-1">
					<p className="font-semibold">
						{summary.cancelled ? "Stopped" : "Finished"}
					</p>
					<p>{summary.reencoded} re-encoded</p>
					<p>{summary.sizeBackfilled} sizes recorded</p>
					<p>{formatBytes(summary.bytesSaved)} saved</p>
					{summary.failed.length > 0 && (
						<>
							<p className="text-red-400">{summary.failed.length} failed:</p>
							<ul className="text-xs text-red-400 list-disc pl-4">
								{summary.failed.slice(0, 10).map((f) => (
									<li key={f.path}>
										{f.path} — {f.error}
									</li>
								))}
							</ul>
						</>
					)}
				</div>
			)}

			<ConfirmDeleteDialog
				isOpen={confirming}
				title="Optimize images"
				message={`${plan?.toReencode ?? 0} images will be re-encoded as WebP and their JPEG originals deleted from storage once each succeeds. Keep this screen open until it finishes; you can stop and resume.`}
				confirmLabel="Start"
				onCancel={() => setConfirming(false)}
				onConfirm={() => {
					setConfirming(false);
					start();
				}}
			/>
		</div>
	);
};

export default ImageOptimizerView;
