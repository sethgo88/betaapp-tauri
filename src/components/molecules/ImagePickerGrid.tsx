import { Spinner } from "@/components/atoms/Spinner";

interface GalleryImage {
	id: string;
	image_url: string;
}

interface ImagePickerGridProps {
	images: GalleryImage[];
	onSelect: (imageUrl: string) => void;
	onUpload: () => void;
	isUploading?: boolean;
}

export function ImagePickerGrid({
	images,
	onSelect,
	onUpload,
	isUploading = false,
}: ImagePickerGridProps) {
	return (
		<div className="flex flex-col gap-3">
			{images.length > 0 && (
				<div className="grid grid-cols-3 gap-2">
					{images.map((img) => (
						<button
							key={img.id}
							type="button"
							onClick={() => onSelect(img.image_url)}
							className="aspect-square rounded-[var(--radius-md)] overflow-hidden"
						>
							<img
								src={img.image_url}
								alt=""
								className="w-full h-full object-cover"
							/>
						</button>
					))}
				</div>
			)}
			<button
				type="button"
				onClick={onUpload}
				disabled={isUploading}
				className="flex items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-dashed border-border-default p-6 text-text-tertiary disabled:opacity-50"
			>
				{isUploading ? <Spinner /> : <span>+ Upload Image</span>}
			</button>
		</div>
	);
}
