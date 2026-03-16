import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Spinner } from "@/components/atoms/Spinner";

interface GalleryImage {
	id: string;
	image_url: string;
}

interface AdminImageGalleryProps {
	images: GalleryImage[];
	isAdmin: boolean;
	onAdd: (file: File) => void;
	onDelete: (id: string, imageUrl: string) => void;
	isAdding?: boolean;
}

export const AdminImageGallery = ({
	images,
	isAdmin,
	onAdd,
	onDelete,
	isAdding = false,
}: AdminImageGalleryProps) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

	// Don't render anything for non-admins when there are no images
	if (images.length === 0 && !isAdmin) return null;

	return (
		<div className="flex flex-col gap-2">
			{/* Thumbnail strip */}
			<div
				className="flex overflow-x-auto gap-2 pb-1"
				style={{ scrollbarWidth: "none" }}
			>
				{isAdmin && (
					<button
						type="button"
						onClick={() => inputRef.current?.click()}
						disabled={isAdding}
						className="shrink-0 w-20 h-20 rounded-[var(--radius-md)] border-2 border-dashed border-border-default flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:border-border-hover transition-colors disabled:opacity-40"
						aria-label="Add image"
					>
						{isAdding ? (
							<Spinner />
						) : (
							<span className="text-2xl leading-none">+</span>
						)}
					</button>
				)}

				{images.map((img) => (
					<div key={img.id} className="relative shrink-0">
						<button
							type="button"
							onClick={() => setFullscreenUrl(img.image_url)}
							className="w-20 h-20 rounded-[var(--radius-md)] overflow-hidden block"
							aria-label="View image"
						>
							<img
								src={img.image_url}
								alt=""
								className="w-full h-full object-cover"
							/>
						</button>
						{isAdmin && (
							<button
								type="button"
								onClick={() => setConfirmDeleteId(img.id)}
								className="absolute top-1 right-1 bg-black/60 rounded-full p-1"
								aria-label="Delete image"
							>
								<Trash2 size={12} className="text-white" />
							</button>
						)}
					</div>
				))}
			</div>

			{/* Hidden file input — triggers native Android gallery picker */}
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) onAdd(file);
					e.target.value = "";
				}}
			/>

			{/* Fullscreen viewer */}
			{fullscreenUrl && (
				<button
					type="button"
					className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
					onClick={() => setFullscreenUrl(null)}
					aria-label="Close image"
				>
					<img
						src={fullscreenUrl}
						alt=""
						className="max-w-full max-h-full object-contain"
					/>
				</button>
			)}

			{/* Delete confirmation sheet */}
			{confirmDeleteId && (
				<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
					<div className="bg-surface-card rounded-t-2xl p-6 w-full flex flex-col gap-3">
						<p className="text-text-primary font-medium text-center">
							Delete this image?
						</p>
						<button
							type="button"
							onClick={() => {
								const img = images.find((i) => i.id === confirmDeleteId);
								if (img) onDelete(img.id, img.image_url);
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
