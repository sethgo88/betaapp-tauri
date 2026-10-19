/**
 * Cache keys identify an image by its remote identity:
 *  - route / wall / topo images: the public URL
 *  - personal climb photos: "climb:{storagePath}" (private bucket, no stable URL)
 */
export function climbImageKey(storagePath: string): string {
	return `climb:${storagePath}`;
}

export type CacheScope = {
	/** 'climb' for personal photos; area scopes are added with area downloads */
	type: string;
	id: string;
};
