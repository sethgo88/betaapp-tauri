import { useNavigate } from "@tanstack/react-router";
import { Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { ConfirmDeleteDialog } from "@/components/molecules/ConfirmDeleteDialog";
import { DownloadImagesButton } from "@/components/molecules/DownloadImagesButton";
import {
	useAreaImageStatuses,
	usePersonalPhotoClimbs,
	useRemoveClimbOfflinePhotos,
	useStorageOverview,
} from "@/features/image-downloads/image-downloads.queries";
import type {
	AreaImageStatus,
	PersonalPhotoClimb,
	ScopeType,
} from "@/features/image-downloads/image-downloads.schema";
import { formatBytes } from "@/lib/format";

const SCOPE_LABEL: Record<ScopeType, string> = {
	sub_region: "Sub-area",
	crag: "Crag",
	wall: "Wall",
	route: "Route",
};

function formatDate(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(`${iso.replace(" ", "T")}Z`);
	return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

const Chip = ({
	children,
	tone,
}: {
	children: string;
	tone: "amber" | "muted";
}) => (
	<span
		className={`text-xs px-2 py-0.5 rounded-full ${
			tone === "amber"
				? "bg-amber-900/40 text-amber-300"
				: "bg-surface-page text-text-primary"
		}`}
	>
		{children}
	</span>
);

const AreaCard = ({ status }: { status: AreaImageStatus }) => {
	const navigate = useNavigate();
	const { record, stats, pendingUpdate } = status;

	const open = () => {
		switch (record.scope_type) {
			case "sub_region":
				navigate({
					to: "/sub-regions/$subRegionId",
					params: { subRegionId: record.scope_id },
				});
				break;
			case "crag":
				navigate({ to: "/crags/$cragId", params: { cragId: record.scope_id } });
				break;
			case "wall":
				navigate({ to: "/walls/$wallId", params: { wallId: record.scope_id } });
				break;
			case "route":
				navigate({
					to: "/routes/$routeId",
					params: { routeId: record.scope_id },
				});
				break;
		}
	};

	return (
		<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-2">
			<button
				type="button"
				onClick={open}
				className="text-left font-semibold text-text-primary"
			>
				{record.name}
			</button>
			<div className="flex flex-wrap items-center gap-2">
				<Chip tone="muted">{SCOPE_LABEL[record.scope_type]}</Chip>
				{record.status === "partial" && <Chip tone="amber">Partial</Chip>}
				{pendingUpdate && (
					<Chip tone="amber">{`Updates available (+${pendingUpdate.added})`}</Chip>
				)}
			</div>
			<p className="text-xs text-text-primary/70">
				{stats.count} {stats.count === 1 ? "image" : "images"} ·{" "}
				{formatBytes(stats.bytes)}
				{record.downloaded_at
					? ` · downloaded ${formatDate(record.downloaded_at)}`
					: ""}
			</p>
			<DownloadImagesButton
				scopeType={record.scope_type}
				scopeId={record.scope_id}
			/>
		</div>
	);
};

const PersonalPhotoRow = ({
	climb,
	onRemove,
}: {
	climb: PersonalPhotoClimb;
	onRemove: () => void;
}) => (
	<div className="rounded-lg bg-surface-card p-4 flex items-center justify-between gap-3">
		<div className="min-w-0">
			<p className="font-semibold text-text-primary truncate">{climb.label}</p>
			<p className="text-xs text-text-primary/70">
				{climb.photoCount} {climb.photoCount === 1 ? "photo" : "photos"} ·{" "}
				{formatBytes(climb.bytes)}
				{climb.offlineAvailable ? " · saved offline" : ""}
			</p>
		</div>
		<button
			type="button"
			onClick={onRemove}
			className="shrink-0 text-sm font-semibold text-accent-primary"
		>
			Remove offline copy
		</button>
	</div>
);

const ImageManagerView = () => {
	const { data: overview } = useStorageOverview();
	const { data: areas = [] } = useAreaImageStatuses();
	const { data: personal = [] } = usePersonalPhotoClimbs();
	const removeOffline = useRemoveClimbOfflinePhotos();
	const [removing, setRemoving] = useState<PersonalPhotoClimb | null>(null);

	const sortedAreas = [...areas].sort(
		(a, b) => Number(!!b.pendingUpdate) - Number(!!a.pendingUpdate),
	);

	return (
		<div className="flex flex-col gap-4">
			<h1 className="font-display text-xl font-semibold text-white">
				Offline images
			</h1>

			<div className="rounded-lg bg-surface-card p-4 flex items-center gap-3">
				<ImageIcon size={20} className="text-text-primary shrink-0" />
				<div>
					<p className="font-semibold text-text-primary">
						{overview?.total.count ?? 0} images ·{" "}
						{formatBytes(overview?.total.bytes ?? 0)}
					</p>
					<p className="text-xs text-text-primary/70">
						{overview?.personal.count ?? 0} personal photos (
						{formatBytes(overview?.personal.bytes ?? 0)})
					</p>
				</div>
			</div>

			<section className="flex flex-col gap-2" aria-label="Downloaded areas">
				<h2 className="text-sm font-semibold text-white uppercase tracking-wide">
					Downloaded areas
				</h2>
				{sortedAreas.length === 0 ? (
					<p className="text-sm text-white">
						No areas downloaded yet. Open a sub-area, crag, wall or route and
						tap Download images.
					</p>
				) : (
					sortedAreas.map((s) => (
						<AreaCard
							key={`${s.record.scope_type}:${s.record.scope_id}`}
							status={s}
						/>
					))
				)}
			</section>

			<section className="flex flex-col gap-2" aria-label="Personal photos">
				<h2 className="text-sm font-semibold text-white uppercase tracking-wide">
					Personal photos
				</h2>
				{personal.length === 0 ? (
					<p className="text-sm text-white">
						No climb photos are stored on this device.
					</p>
				) : (
					personal.map((c) => (
						<PersonalPhotoRow
							key={c.climbId}
							climb={c}
							onRemove={() => setRemoving(c)}
						/>
					))
				)}
			</section>

			<ConfirmDeleteDialog
				isOpen={!!removing}
				title="Delete offline copy"
				message={`The photos for ${removing?.label ?? "this climb"} will be removed from this device. They stay in your account, and any photo still waiting to upload is kept.`}
				onCancel={() => setRemoving(null)}
				onConfirm={() => {
					if (removing) removeOffline.mutate(removing.climbId);
					setRemoving(null);
				}}
			/>
		</div>
	);
};

export default ImageManagerView;
