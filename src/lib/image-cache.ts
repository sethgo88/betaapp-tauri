import {
	BaseDirectory,
	exists,
	mkdir,
	readFile,
	remove,
	writeFile,
} from "@tauri-apps/plugin-fs";

/**
 * File storage for cached images, kept in the app-private data directory
 * under `image-cache/`. Wrapped behind an interface so unit tests can swap in
 * an in-memory store.
 */
export interface ImageFileStore {
	write(name: string, bytes: Uint8Array): Promise<void>;
	read(name: string): Promise<Uint8Array>;
	remove(name: string): Promise<void>;
}

const DIR = "image-cache";
const base = { baseDir: BaseDirectory.AppData } as const;

let dirReady: Promise<void> | null = null;

function ensureDir(): Promise<void> {
	if (!dirReady) {
		dirReady = (async () => {
			if (!(await exists(DIR, base))) {
				await mkdir(DIR, { ...base, recursive: true });
			}
		})().catch((err) => {
			dirReady = null;
			throw err;
		});
	}
	return dirReady;
}

const tauriStore: ImageFileStore = {
	async write(name, bytes) {
		await ensureDir();
		await writeFile(`${DIR}/${name}`, bytes, base);
	},
	read(name) {
		return readFile(`${DIR}/${name}`, base);
	},
	async remove(name) {
		await remove(`${DIR}/${name}`, base).catch(() => {
			// Already gone — nothing to clean up
		});
	},
};

let store: ImageFileStore = tauriStore;

export function getImageFileStore(): ImageFileStore {
	return store;
}

/** Replace the file store (tests only). */
export function setImageFileStore(next: ImageFileStore | null): void {
	store = next ?? tauriStore;
}
