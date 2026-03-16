import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
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
import { ClimbImageViewer } from "./ClimbImageViewer";

interface ClimbImageGalleryProps {
	climbId: string;
}

export const ClimbImageGallery = ({ climbId }: ClimbImageGalleryProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const { data: images = [] } = useClimbImages(climbId);
	const { data: imageCount = 0 } = useUserImageCount();
	const addImage = useAddClimbImage(climbId);
	const deleteImage = useDeleteClimbImage(climbId);
	const reorder = useReorderClimbImages(climbId);

	const [viewerImageId, setViewerImageId] = useState<string | null>(null);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

	const atCap = imageCount >= USER_IMAGE_CAP;
	const viewerImage = images.find((img) => img.id === viewerImageId) ?? null;

	function moveImage(index: number, direction: -1 | 1) {
		const newIndex = index + direction;
		if (newIndex < 0 || newIndex >= images.length) return;
		const ids = images.map((img) => img.id);
		[ids[index], ids[newIndex]] = [ids[newIndex], ids[index]];
		reorder.mutate(ids);
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<span className="text-sm text-text-secondary">
					Photos ({imageCount} / {USER_IMAGE_CAP})
				</span>
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					disabled={addImage.isPending || atCap}
					className="text-xs text-accent-primary font-semibold disabled:opacity-40"
				>
					{addImage.isPending
						? "Uploading…"
						: atCap
							? "Cap reached"
							: "+ Add photo"}
				</button>
			</div>

			{images.length === 0 && !addImage.isPending && (
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					disabled={atCap}
					className="rounded-[var(--radius-md)] border-2 border-dashed border-border-default h-20 flex items-center justify-center text-text-tertiary text-sm disabled:opacity-40"
				>
					Add a photo
				</button>
			)}

			{(images.length > 0 || addImage.isPending) && (
				<div
					className="flex overflow-x-auto gap-2 pb-1"
					style={{ scrollbarWidth: "none" }}
				>
					{addImage.isPending && (
						<div className="shrink-0 w-20 h-20 rounded-[var(--radius-md)] bg-surface-card flex items-center justify-center">
							<Spinner />
						</div>
					)}
					{images.map((img, index) => (
						<div key={img.id} className="relative shrink-0 flex flex-col gap-1">
							<button
								type="button"
								onClick={() => setViewerImageId(img.id)}
								className="w-20 h-20 rounded-[var(--radius-md)] overflow-hidden block"
								aria-label="View photo"
							>
								<img
									src={img.signed_url}
									alt=""
									className="w-full h-full object-cover"
								/>
							</button>
							<button
								type="button"
								onClick={() => setConfirmDeleteId(img.id)}
								className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
								aria-label="Delete photo"
							>
								<Trash2 size={12} className="text-white" />
							</button>
							{/* Reorder arrows */}
							<div className="flex justify-between px-0.5">
								<button
									type="button"
									onClick={() => moveImage(index, -1)}
									disabled={index === 0 || reorder.isPending}
									className="text-text-tertiary disabled:opacity-20"
									aria-label="Move left"
								>
									<ChevronLeft size={14} />
								</button>
								<button
									type="button"
									onClick={() => moveImage(index, 1)}
									disabled={index === images.length - 1 || reorder.isPending}
									className="text-text-tertiary disabled:opacity-20"
									aria-label="Move right"
								>
									<ChevronRight size={14} />
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Hidden file input */}
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

			{/* Full-screen viewer */}
			{viewerImage && (
				<ClimbImageViewer
					image={viewerImage}
					onClose={() => setViewerImageId(null)}
				/>
			)}

			{/* Delete confirmation sheet */}
			{confirmDeleteId && (
				<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
					<div className="bg-surface-card rounded-t-2xl p-6 w-full flex flex-col gap-3">
						<p className="text-text-primary font-medium text-center">
							Delete this photo?
						</p>
						<button
							type="button"
							onClick={() => {
								const img = images.find((i) => i.id === confirmDeleteId);
								if (img) {
									deleteImage.mutate({
										id: img.id,
										storagePath: img.image_url,
									});
								}
								setConfirmDeleteId(null);
							}}
							className="w-full py-3 rounded-[var(--radius-md)] bg-red-500 text-white font-medium"
						>
							Delete
						</button>
						<button
							type="button"
							onClick={() => setConfirmDeleteId(null)}
							className="w-full py-2 text-text-secondary"
						>
							Cancel
						</button>
					</div>
				</div>
			)}
		</div>
	);
};
