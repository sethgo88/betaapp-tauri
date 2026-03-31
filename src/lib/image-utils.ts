import { supabase } from "@/lib/supabase";

/**
 * Resize and compress an image file using the Canvas API.
 * Caps the longest dimension at maxPx, then encodes as JPEG at the given quality.
 * No external libraries — runs entirely in the WebView.
 */
export function resizeAndCompress(
	file: File,
	maxPx = 1920,
	quality = 0.8,
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		img.onload = () => {
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
			canvas.toBlob(
				(blob) => {
					if (blob) resolve(blob);
					else reject(new Error("canvas.toBlob returned null"));
				},
				"image/jpeg",
				quality,
			);
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
 * Returns the storage path (e.g. "userId/climbId/uuid.jpg") — not a full URL.
 * Callers should derive a displayable URL from the path:
 *   - Public bucket:  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
 *   - Private bucket: (await supabase.storage.from(bucket).createSignedUrl(path, 3600)).data?.signedUrl
 */
export async function uploadToStorage(
	bucket: string,
	path: string,
	file: File,
): Promise<string> {
	const blob = await resizeAndCompress(file);
	return uploadBlobToStorage(bucket, path, blob);
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
			contentType: "image/jpeg",
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
