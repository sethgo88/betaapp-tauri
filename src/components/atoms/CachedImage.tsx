import { ImageOff } from "lucide-react";
import { forwardRef, type ImgHTMLAttributes, useEffect, useState } from "react";
import { useCachedImageUrl } from "@/features/image-cache/image-cache.queries";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
	alt: string;
	/** Remote URL (or empty when the image only exists locally). */
	src?: string | null;
	/** Cache identity; omit for images that are never cached (e.g. local previews). */
	cacheKey?: string | null;
};

/**
 * `<img>` that prefers the locally cached file over the network. Shows a
 * placeholder when there is nothing to show — offline and not downloaded — or
 * when the image fails to load (deleted, blocked, network error).
 */
export const CachedImage = forwardRef<HTMLImageElement, Props>(
	({ src, cacheKey, alt, onError, className, ...rest }, ref) => {
		const resolved = useCachedImageUrl(cacheKey, src);
		const [failed, setFailed] = useState(false);

		// A new source (e.g. the cached file arrived) gets a fresh chance to load
		// biome-ignore lint/correctness/useExhaustiveDependencies: reset when the source changes
		useEffect(() => setFailed(false), [resolved]);

		if (!resolved || failed) {
			return (
				<div
					role="img"
					aria-label={alt ? `${alt} (unavailable)` : "Image unavailable"}
					className={`${className ?? ""} min-h-16 bg-surface-raised flex items-center justify-center text-text-primary/50`}
				>
					<ImageOff size={20} aria-hidden="true" />
				</div>
			);
		}
		return (
			// biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError only swaps in the placeholder, not a user interaction
			<img
				ref={ref}
				src={resolved}
				alt={alt}
				className={className}
				onError={(e) => {
					setFailed(true);
					onError?.(e);
				}}
				{...rest}
			/>
		);
	},
);
CachedImage.displayName = "CachedImage";
