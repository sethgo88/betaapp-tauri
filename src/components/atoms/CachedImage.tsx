import { forwardRef, type ImgHTMLAttributes } from "react";
import { useCachedImageUrl } from "@/features/image-cache/image-cache.queries";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
	alt: string;
	/** Remote URL (or empty when the image only exists locally). */
	src?: string | null;
	/** Cache identity; omit for images that are never cached (e.g. local previews). */
	cacheKey?: string | null;
};

/** `<img>` that prefers the locally cached file over the network. */
export const CachedImage = forwardRef<HTMLImageElement, Props>(
	({ src, cacheKey, alt, ...rest }, ref) => {
		const resolved = useCachedImageUrl(cacheKey, src);
		if (!resolved) {
			return (
				<div
					role="img"
					aria-label={alt || "Image unavailable"}
					className={`${rest.className ?? ""} bg-surface-raised`}
				/>
			);
		}
		return <img ref={ref} src={resolved} alt={alt} {...rest} />;
	},
);
CachedImage.displayName = "CachedImage";
