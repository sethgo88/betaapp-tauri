import {
	ChevronLeft,
	ChevronRight,
	Film,
	ImagePlus,
	Trash2,
} from "lucide-react";
import { useRef, useState } from "react";
import { Spinner } from "@/components/atoms/Spinner";
import {
	USER_IMAGE_CAP,
	useAddClimbImage,
	useClimbImages,
	useDeleteClimbImage,
	useReorderClimbImages,
	useUserImageCount,
} from "@/features/climb-images/climb-images.queries";
import type { ClimbImageWithUrl } from "@/features/climb-images/climb-images.schema";
import { ClimbImageViewer } from "./ClimbImageViewer";
import { PhotoViewer } from "./PhotoViewer";
import { VideoFrameCapturer } from "./VideoFrameCapturer";

const THUMB_SIZE = 96; // px — width & height of each thumbnail cell
const CAROUSEL_THUMB = 56; // px — width & height of carousel thumbnails in sheet

interface ClimbImageGalleryProps {
	climbId: string;
}

// ── Per-image action sheet ────────────────────────────────────────────────────

interface ImageActionSheetProps {
	image: ClimbImageWithUrl;
	allImages: ClimbImageWithUrl[];
	index: number;
	total: number;
	isReordering: boolean;
	onMoveLeft: () => void;
	onMoveRight: () => void;
	onEditPins: () => void;
	onDelete: () => void;
	onClose: () => void;
	onSelectImage: (id: string) => void;
	onViewFullscreen: () => void;
}

const ImageActionSheet = ({
	image,
	allImages,
	index,
	total,
	isReordering,
	onMoveLeft,
	onMoveRight,
	onEditPins,
	onDelete,
	onClose,
	onSelectImage,
	onViewFullscreen,
}: ImageActionSheetProps) => {
	const [confirmDelete, setConfirmDelete] = useState(false);

	return (
		<div
			className="fixed inset-0 z-40 flex items-end justify-center bg-black/50"
			onClick={onClose}
			onKeyDown={(e) => e.key === "Escape" && onClose()}
			role="dialog"
			aria-modal="true"
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: sheet stops backdrop tap from closing */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: touch surface, not a focusable control */}
			<div
				className="bg-surface-card rounded-t-2xl w-full flex flex-col overflow-hidden"
				style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Main image preview — tap to open full-screen PhotoViewer */}
				<button
					type="button"
					onClick={onViewFullscreen}
					className="w-full aspect-video bg-black flex items-center justify-center overflow-hidden"
					aria-label="View full screen"
				>
					<img
						src={image.signed_url}
						alt=""
						className="max-w-full max-h-full object-contain"
					/>
				</button>

				{/* Image carousel — visible when more than one image */}
				{allImages.length > 1 && (
					<div className="flex gap-2 px-3 py-2 overflow-x-auto">
						{allImages.map((img) => (
							<button
								key={img.id}
								type="button"
								onClick={() => onSelectImage(img.id)}
								aria-label="Select photo"
								className="shrink-0 rounded overflow-hidden transition-opacity"
								style={{
									width: CAROUSEL_THUMB,
									height: CAROUSEL_THUMB,
									outline:
										img.id === image.id
											? "2px solid var(--color-accent-primary)"
											: "2px solid transparent",
									opacity: img.id === image.id ? 1 : 0.6,
								}}
							>
								<img
									src={img.signed_url}
									alt=""
									className="w-full h-full object-cover"
								/>
							</button>
						))}
					</div>
				)}

				{confirmDelete ? (
					<div className="flex flex-col gap-3 p-5">
						<p className="text-text-primary font-medium text-center">
							Delete this photo?
						</p>
						<button
							type="button"
							onClick={onDelete}
							className="w-full py-3 rounded-[var(--radius-md)] bg-red-500 text-white font-medium"
						>
							Delete
						</button>
						<button
							type="button"
							onClick={() => setConfirmDelete(false)}
							className="w-full py-2 text-text-secondary"
						>
							Cancel
						</button>
					</div>
				) : (
					<div className="flex flex-col gap-1 p-3">
						{/* Sort row */}
						<div className="flex items-center justify-between px-2 py-3 border-b border-border-default">
							<span className="text-sm text-text-secondary">
								Photo {index + 1} of {total}
							</span>
							<div className="flex items-center gap-4">
								<button
									type="button"
									onClick={onMoveLeft}
									disabled={index === 0 || isReordering}
									className="text-text-secondary disabled:opacity-30"
									aria-label="Move left"
								>
									<ChevronLeft size={20} />
								</button>
								<button
									type="button"
									onClick={onMoveRight}
									disabled={index === total - 1 || isReordering}
									className="text-text-secondary disabled:opacity-30"
									aria-label="Move right"
								>
									<ChevronRight size={20} />
								</button>
							</div>
						</div>

						{/* Actions */}
						<button
							type="button"
							onClick={onEditPins}
							className="w-full text-left px-2 py-3 text-text-primary border-b border-border-default"
						>
							Edit pins
						</button>
						<button
							type="button"
							onClick={() => setConfirmDelete(true)}
							className="w-full text-left px-2 py-3 text-red-400 flex items-center gap-2"
						>
							<Trash2 size={16} />
							Delete photo
						</button>
					</div>
				)}
			</div>
		</div>
	);
};

// ── Gallery ───────────────────────────────────────────────────────────────────

export const ClimbImageGallery = ({ climbId }: ClimbImageGalleryProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const { data: images = [] } = useClimbImages(climbId);
	const { data: imageCount = 0 } = useUserImageCount();
	const addImage = useAddClimbImage(climbId);
	const deleteImage = useDeleteClimbImage(climbId);
	const reorder = useReorderClimbImages(climbId);

	const [sheetImageId, setSheetImageId] = useState<string | null>(null);
	const [viewerImageId, setViewerImageId] = useState<string | null>(null);
	const [photoViewerImageId, setPhotoViewerImageId] = useState<string | null>(
		null,
	);
	const [showVideoCapturer, setShowVideoCapturer] = useState(false);

	const atCap = imageCount >= USER_IMAGE_CAP;
	const sheetImage = images.find((img) => img.id === sheetImageId) ?? null;
	const sheetIndex = images.findIndex((img) => img.id === sheetImageId);
	const viewerImage = images.find((img) => img.id === viewerImageId) ?? null;
	const photoViewerImage =
		images.find((img) => img.id === photoViewerImageId) ?? null;

	function moveImage(index: number, direction: -1 | 1) {
		const newIndex = index + direction;
		if (newIndex < 0 || newIndex >= images.length) return;
		const ids = images.map((img) => img.id);
		[ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
		reorder.mutate(ids);
	}

	function handleDelete() {
		if (!sheetImage) return;
		deleteImage.mutate({
			id: sheetImage.id,
			storagePath: sheetImage.image_url,
		});
		setSheetImageId(null);
	}

	return (
		<div className="flex flex-col gap-2">
			<span className="text-sm text-text-secondary">
				Photos ({imageCount} / {USER_IMAGE_CAP})
			</span>

			{/* Thumbnail grid */}
			<div
				className="grid gap-2"
				style={{
					gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB_SIZE}px, 1fr))`,
				}}
			>
				{/* Upload-in-progress placeholder */}
				{addImage.isPending && (
					<div
						className="rounded-[var(--radius-md)] bg-surface-card flex items-center justify-center"
						style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
					>
						<Spinner />
					</div>
				)}

				{/* Thumbnails */}
				{images.map((img) => (
					<button
						key={img.id}
						type="button"
						onClick={() => setSheetImageId(img.id)}
						aria-label="View photo options"
						className="rounded-[var(--radius-md)] overflow-hidden block"
						style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
					>
						<img
							src={img.signed_url}
							alt=""
							className="w-full h-full object-cover"
						/>
					</button>
				))}

				{/* Dotted add tile */}
				{!atCap && (
					<button
						type="button"
						onClick={() => inputRef.current?.click()}
						disabled={addImage.isPending}
						aria-label="Add photo"
						className="rounded-[var(--radius-md)] border-2 border-dashed border-border-default flex items-center justify-center text-text-tertiary disabled:opacity-40"
						style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
					>
						<ImagePlus size={24} />
					</button>
				)}
			</div>

			{/* Hidden photo file input */}
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) addImage.mutate(file);
					e.target.value = "";
				}}
			/>

			{/* Capture from video link */}
			{!atCap && (
				<button
					type="button"
					onClick={() => setShowVideoCapturer(true)}
					disabled={addImage.isPending}
					className="flex items-center gap-1.5 text-xs text-text-tertiary disabled:opacity-40 self-start"
				>
					<Film size={13} />
					Capture from video
				</button>
			)}

			{/* Per-image action sheet */}
			{sheetImage && (
				<ImageActionSheet
					key={sheetImage.id}
					image={sheetImage}
					allImages={images}
					index={sheetIndex}
					total={images.length}
					isReordering={reorder.isPending}
					onMoveLeft={() => moveImage(sheetIndex, -1)}
					onMoveRight={() => moveImage(sheetIndex, 1)}
					onEditPins={() => {
						setViewerImageId(sheetImage.id);
						setSheetImageId(null);
					}}
					onDelete={handleDelete}
					onClose={() => setSheetImageId(null)}
					onSelectImage={(id) => setSheetImageId(id)}
					onViewFullscreen={() => {
						setPhotoViewerImageId(sheetImage.id);
						setSheetImageId(null);
					}}
				/>
			)}

			{/* Full-screen photo viewer (pinch-to-zoom) */}
			{photoViewerImage && (
				<PhotoViewer
					src={photoViewerImage.signed_url}
					onClose={() => setPhotoViewerImageId(null)}
				/>
			)}

			{/* Full-screen pin viewer/editor */}
			{viewerImage && (
				<ClimbImageViewer
					image={viewerImage}
					onClose={() => setViewerImageId(null)}
				/>
			)}

			{/* Video frame capturer */}
			{showVideoCapturer && (
				<VideoFrameCapturer
					onCapture={(file) => {
						addImage.mutate(file);
						setShowVideoCapturer(false);
					}}
					onClose={() => setShowVideoCapturer(false)}
				/>
			)}
		</div>
	);
};
