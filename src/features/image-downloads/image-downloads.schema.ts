export type ScopeType = "sub_region" | "crag" | "wall" | "route";

export type ScopeImage = { key: string; sizeBytes: number | null };

export type ImageDownloadStatus = "complete" | "partial";

export type ImageDownload = {
	scope_type: ScopeType;
	scope_id: string;
	name: string;
	status: ImageDownloadStatus;
	image_count: number;
	downloaded_at: string | null;
};

export type ScopeSummary = {
	/** Unique images belonging to the area (including all children) */
	total: number;
	/** Images not yet on the device */
	toDownload: number;
	/** Bytes of the to-download images that have a recorded size */
	knownBytes: number;
	/** To-download images with no recorded size (legacy uploads) */
	unknownCount: number;
	/** Downloaded images no longer in the area (deleted by an admin); a re-fetch deletes them */
	toRemove: number;
	/** True when the region's data isn't on the device, so counts can't be known yet */
	regionDataMissing: boolean;
	areaName: string;
	regionName: string | null;
};

export type DownloadResult = {
	downloaded: number;
	failed: number;
	cancelled: boolean;
};

export type AreaImageStatus = {
	record: ImageDownload;
	/** What is on disk for this area */
	stats: { count: number; bytes: number };
	/** Changes since the last download; null when up to date */
	pendingUpdate: {
		/** New images in the area that aren't downloaded yet */
		added: number;
		/** Downloaded images that have since been removed from the area */
		removed: number;
	} | null;
};

export type StorageOverview = {
	total: { count: number; bytes: number };
	personal: { count: number; bytes: number };
};

export type PersonalPhotoClimb = {
	climbId: string;
	label: string;
	photoCount: number;
	bytes: number;
	offlineAvailable: boolean;
};
