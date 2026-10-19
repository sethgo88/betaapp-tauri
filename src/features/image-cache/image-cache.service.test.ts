import type BetterSqlite3 from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock supabase before any module that imports it is loaded.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { type ImageFileStore, setImageFileStore } from "@/lib/image-cache";
import { setupTestDb } from "@/test/setup-db";
import {
	cacheImage,
	getCachedKeys,
	getCacheStats,
	migrateLocalDataToFiles,
	readCachedBlob,
	releaseRef,
	releaseScope,
} from "./image-cache.service";

function createMemoryStore(): ImageFileStore & {
	files: Map<string, Uint8Array>;
} {
	const files = new Map<string, Uint8Array>();
	return {
		files,
		async write(name, bytes) {
			files.set(name, bytes);
		},
		async read(name) {
			const bytes = files.get(name);
			if (!bytes) throw new Error("not found");
			return bytes;
		},
		async remove(name) {
			files.delete(name);
		},
	};
}

const blob = (text: string, type = "image/webp") => new Blob([text], { type });

describe("image-cache.service", () => {
	let sqlite: BetterSqlite3.Database;
	let store: ReturnType<typeof createMemoryStore>;

	beforeEach(async () => {
		sqlite = await setupTestDb();
		store = createMemoryStore();
		setImageFileStore(store);
	});

	it("caches an image, reads it back and reports stats", async () => {
		await cacheImage("https://x/a.webp", blob("hello"), {
			type: "crag",
			id: "c1",
		});
		expect(store.files.size).toBe(1);
		const read = await readCachedBlob("https://x/a.webp");
		expect(read?.type).toBe("image/webp");
		expect(await read?.text()).toBe("hello");
		expect(await getCacheStats()).toEqual({ count: 1, bytes: 5 });
		expect(await getCacheStats({ type: "crag", id: "c1" })).toEqual({
			count: 1,
			bytes: 5,
		});
		expect([...(await getCachedKeys(["https://x/a.webp", "nope"]))]).toEqual([
			"https://x/a.webp",
		]);
	});

	it("keeps a shared file until its last scope releases it", async () => {
		const key = "https://x/shared.webp";
		await cacheImage(key, blob("data"), { type: "crag", id: "c1" });
		await cacheImage(key, blob("data"), { type: "sub_region", id: "s1" });
		expect(store.files.size).toBe(1);

		await releaseRef(key, { type: "crag", id: "c1" });
		expect(store.files.size).toBe(1);
		expect(await readCachedBlob(key)).not.toBeNull();

		await releaseScope({ type: "sub_region", id: "s1" });
		expect(store.files.size).toBe(0);
		expect(await readCachedBlob(key)).toBeNull();
	});

	it("drops the row when the file has gone missing", async () => {
		await cacheImage("k", blob("x"), { type: "climb", id: "c" });
		store.files.clear();
		expect(await readCachedBlob("k")).toBeNull();
		expect(await getCacheStats()).toEqual({ count: 0, bytes: 0 });
	});

	it("migrates legacy base64 local_data into files", async () => {
		sqlite
			.prepare(
				`INSERT INTO climb_images (id, climb_id, user_id, image_url, sort_order, local_data, upload_status)
         VALUES ('i1', 'cl1', 'u1', 'u1/cl1/i1.jpg', 0, ?, 'uploaded')`,
			)
			.run(`data:image/jpeg;base64,${btoa("jpegbytes")}`);

		await migrateLocalDataToFiles();

		const row = sqlite
			.prepare("SELECT local_data FROM climb_images WHERE id = 'i1'")
			.get() as { local_data: string | null };
		expect(row.local_data).toBeNull();
		const read = await readCachedBlob("climb:u1/cl1/i1.jpg");
		expect(await read?.text()).toBe("jpegbytes");
		expect(await getCacheStats({ type: "climb", id: "cl1" })).toEqual({
			count: 1,
			bytes: 9,
		});
	});
});
