import { supabase } from "@/lib/supabase";

export type ImagePreset = "beta" | "reference";

/**
 * Size/quality presets, kept small for mobile storage and bandwidth.
 *   beta      — personal beta photos (hold positions only need to be legible)
 *   reference — shared route/wall/topo images (viewed by everyone, topo lines drawn on top)
 */
const PRESETS: Record<ImagePreset, { maxPx: number; quality: number }> = {
	beta: { maxPx: 1280, quality: 0.65 },
	reference: { maxPx: 1600, quality: 0.75 },
};

function canvasToBlob(
	canvas: HTMLCanvasElement,
	type: string,
	quality: number,
): Promise<Blob | null> {
	return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** File extension (without dot) for an encoded image blob. */
export function extForBlob(blob: Blob): string {
	return blob.type === "image/webp" ? "webp" : "jpg";
}

/**
 * Resize and compress an image file using the Canvas API.
 * Caps the longest dimension per preset and encodes as WebP, falling back to
 * JPEG when the WebView cannot encode WebP (toBlob then returns another type).
 * No external libraries — runs entirely in the WebView.
 */
export function resizeAndCompress(
	file: File,
	preset: ImagePreset = "reference",
): Promise<Blob> {
	const { maxPx, quality } = PRESETS[preset];
	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		img.onload = async () => {
			URL.revokeObjectURL(objectUrl);

			const { width, height } = img;
			const scale = Math.min(1, maxPx / Math.max(width, height));
			const canvas = document.createElement("canvas");
			canvas.width = Math.round(width * scale);
			canvas.height = Math.round(height * scale);

			const ctx = canvas.getContext("2d");
			if (!ctx) {
				reject(new Error("Could not get 2D canvas context"));
				return;
			}

			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
			let blob = await canvasToBlob(canvas, "image/webp", quality);
			if (!blob || blob.type !== "image/webp") {
				blob = await canvasToBlob(canvas, "image/jpeg", quality);
			}
			if (blob) resolve(blob);
			else reject(new Error("canvas.toBlob returned null"));
		};

		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error("Failed to load image for resizing"));
		};

		img.src = objectUrl;
	});
}

/**
 * Resize, compress, and upload a file to Supabase Storage.
 *
 * `pathBase` is the storage path without extension; the extension is added
 * from the encoded format. Returns the final storage path (e.g.
 * "userId/climbId/uuid.webp") and the encoded size — not a full URL.
 * Callers should derive a displayable URL from the path:
 *   - Public bucket:  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
 *   - Private bucket: (await supabase.storage.from(bucket).createSignedUrl(path, 3600)).data?.signedUrl
 */
export async function uploadToStorage(
	bucket: string,
	pathBase: string,
	file: File,
	preset: ImagePreset = "reference",
): Promise<{ path: string; sizeBytes: number }> {
	const blob = await resizeAndCompress(file, preset);
	const path = await uploadBlobToStorage(
		bucket,
		`${pathBase}.${extForBlob(blob)}`,
		blob,
	);
	return { path, sizeBytes: blob.size };
}

/** Upload a pre-compressed Blob to Supabase Storage. Returns the storage path. */
export async function uploadBlobToStorage(
	bucket: string,
	path: string,
	blob: Blob,
): Promise<string> {
	const { data, error } = await supabase.storage
		.from(bucket)
		.upload(path, blob, {
			contentType: blob.type || "image/jpeg",
			upsert: true,
		});

	if (error) throw error;
	return data.path;
}

/** Convert a Blob to a base64 data URI (e.g. "data:image/jpeg;base64,..."). */
export function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			if (typeof reader.result === "string") resolve(reader.result);
			else reject(new Error("FileReader did not return a string"));
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

/** Convert a base64 data URI back to a Blob. */
export function base64ToBlob(dataUri: string): Blob {
	const [header, base64] = dataUri.split(",");
	const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new Blob([bytes], { type: mime });
}
