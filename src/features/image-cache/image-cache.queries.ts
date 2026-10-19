import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { readCachedBlob } from "./image-cache.service";

export const CACHED_IMAGE_KEY = "cached-image";

/**
 * Resolve an image to a displayable URL: the local cached file when one
 * exists, otherwise `remoteUrl`. Local reads never need the network, so the
 * query runs offline-first.
 */
export function useCachedImageUrl(
	cacheKey: string | null | undefined,
	remoteUrl: string | null | undefined,
): string | undefined {
	const { data: blob } = useQuery({
		queryKey: [CACHED_IMAGE_KEY, cacheKey],
		queryFn: () => readCachedBlob(cacheKey as string),
		enabled: !!cacheKey,
		staleTime: Number.POSITIVE_INFINITY,
		networkMode: "offlineFirst",
	});

	const [objectUrl, setObjectUrl] = useState<string>();
	useEffect(() => {
		if (!blob) {
			setObjectUrl(undefined);
			return;
		}
		const url = URL.createObjectURL(blob);
		setObjectUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [blob]);

	return objectUrl ?? remoteUrl ?? undefined;
}
