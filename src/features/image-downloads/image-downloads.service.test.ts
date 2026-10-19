import type BetterSqlite3 from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
const downloadRegion = vi.fn(async () => {});
vi.mock("@/features/locations/locations.service", () => ({
	downloadRegion: (...args: unknown[]) => downloadRegion(...(args as [])),
}));

import { clearClimbImageCache } from "@/features/climb-images/climb-images.service";
import {
	cacheImage,
	getCacheStats,
	readCachedBlob,
} from "@/features/image-cache/image-cache.service";
import { type ImageFileStore, setImageFileStore } from "@/lib/image-cache";
import { setupTestDb } from "@/test/setup-db";
import {
	collectScopeImages,
	deleteScopeImages,
	downloadScopeImages,
	fetchImageDownload,
	getAreaImageStatuses,
	getScopeSummary,
	getStorageOverview,
	listPersonalPhotoClimbs,
} from "./image-downloads.service";

function memoryStore(): ImageFileStore & { files: Map<string, Uint8Array> } {
	const files = new Map<string, Uint8Array>();
	return {
		files,
		async write(n, b) {
			files.set(n, b);
		},
		async read(n) {
			const b = files.get(n);
			if (!b) throw new Error("missing");
			return b;
		},
		async remove(n) {
			files.delete(n);
		},
	};
}

const okFetch = (async (url: string) =>
	new Response(new Blob([`bytes:${url}`], { type: "image/webp" }), {
		status: 200,
	})) as unknown as typeof fetch;

function seed(db: BetterSqlite3.Database) {
	db.exec(`
    INSERT INTO regions_cache (id, country_id, name, sort_order) VALUES ('reg1','c1','Region One',0);
    INSERT INTO downloaded_regions (region_id) VALUES ('reg1');
    INSERT INTO sub_regions_cache (id, region_id, name, sort_order) VALUES ('sr1','reg1','Sub One',0);
    INSERT INTO crags_cache (id, sub_region_id, name, sort_order) VALUES ('cr1','sr1','Crag A',0), ('cr2','sr1','Crag B',1);
    INSERT INTO walls_cache (id, crag_id, name, sort_order) VALUES ('w1','cr1','Wall 1',0), ('w2','cr2','Wall 2',0);
    INSERT INTO routes_cache (id, wall_id, name, grade, created_by) VALUES
      ('r1','w1','Route 1','6a','u'), ('r2','w1','Route 2','6b','u'), ('r3','w2','Route 3','7a','u');
    INSERT INTO wall_images_cache (id, wall_id, image_url, sort_order, uploaded_by, size_bytes) VALUES
      ('wi1','w1','https://s/w1.webp',0,'u',1000), ('wi2','w2','https://s/w2.webp',0,'u',NULL);
    INSERT INTO wall_topos_cache (id, wall_id, image_url, size_bytes) VALUES
      ('wt1','w1','https://s/w1.webp',1000);
    INSERT INTO route_images_cache (id, route_id, image_url, sort_order, uploaded_by, size_bytes) VALUES
      ('ri1','r1','https://s/r1.webp',0,'u',500);
    INSERT INTO route_topos_cache (id, route_id, image_url, points, size_bytes) VALUES
      ('rt1','r3','https://s/r3t.webp','[]',700);
  `);
}

describe("image-downloads.service", () => {
	let sqlite: BetterSqlite3.Database;
	let store: ReturnType<typeof memoryStore>;

	beforeEach(async () => {
		sqlite = await setupTestDb();
		store = memoryStore();
		setImageFileStore(store);
		downloadRegion.mockClear();
		seed(sqlite);
	});

	it("collects every descendant image once, deduped by URL", async () => {
		const keys = (await collectScopeImages("sub_region", "sr1"))
			.map((i) => i.key)
			.sort();
		expect(keys).toEqual([
			"https://s/r1.webp",
			"https://s/r3t.webp",
			"https://s/w1.webp",
			"https://s/w2.webp",
		]);
		const crag = (await collectScopeImages("crag", "cr1")).map((i) => i.key);
		expect(crag.sort()).toEqual(["https://s/r1.webp", "https://s/w1.webp"]);
	});

	it("route scope includes its own images and its wall's topo, not the wall gallery", async () => {
		sqlite.exec(
			"INSERT INTO wall_topos_cache (id, wall_id, image_url, size_bytes) VALUES ('wt2','w2','https://s/w2topo.webp',300)",
		);
		const keys = (await collectScopeImages("route", "r3"))
			.map((i) => i.key)
			.sort();
		expect(keys).toEqual(["https://s/r3t.webp", "https://s/w2topo.webp"]);
	});

	it("summarises count, known bytes and unknown-size images", async () => {
		const s = await getScopeSummary("sub_region", "sr1");
		expect(s).toMatchObject({
			total: 4,
			toDownload: 4,
			knownBytes: 1000 + 500 + 700,
			unknownCount: 1,
			regionDataMissing: false,
			areaName: "Sub One",
			regionName: "Region One",
		});
	});

	it("flags missing region data without counting", async () => {
		sqlite.exec("DELETE FROM downloaded_regions");
		const s = await getScopeSummary("sub_region", "sr1");
		expect(s.regionDataMissing).toBe(true);
		expect(s.total).toBe(0);
	});

	it("downloads missing images, registers the area, and skips cached ones next time", async () => {
		const fetchSpy = vi.fn(okFetch);
		const progress: number[] = [];
		const result = await downloadScopeImages("crag", "cr1", {
			fetchImpl: fetchSpy as unknown as typeof fetch,
			onProgress: (done) => progress.push(done),
		});
		expect(result).toEqual({ downloaded: 2, failed: 0, cancelled: false });
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(progress[progress.length - 1]).toBe(2);
		expect((await fetchImageDownload("crag", "cr1"))?.status).toBe("complete");
		expect(await readCachedBlob("https://s/w1.webp")).not.toBeNull();

		fetchSpy.mockClear();
		await downloadScopeImages("crag", "cr1", {
			fetchImpl: fetchSpy as unknown as typeof fetch,
		});
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(downloadRegion).not.toHaveBeenCalled();
	});

	it("downloads region data first when it is missing", async () => {
		sqlite.exec("DELETE FROM downloaded_regions");
		await downloadScopeImages("wall", "w1", { fetchImpl: okFetch });
		expect(downloadRegion).toHaveBeenCalledWith("reg1");
	});

	it("leaves the area partial on failure, and resumes only the missing images", async () => {
		const failing = vi.fn(async (url: string) =>
			url.includes("r1")
				? new Response("nope", { status: 500 })
				: new Response(new Blob(["x"], { type: "image/webp" }), {
						status: 200,
					}),
		);
		const first = await downloadScopeImages("crag", "cr1", {
			fetchImpl: failing as unknown as typeof fetch,
		});
		expect(first.failed).toBe(1);
		expect((await fetchImageDownload("crag", "cr1"))?.status).toBe("partial");

		const resume = vi.fn(okFetch);
		const second = await downloadScopeImages("crag", "cr1", {
			fetchImpl: resume as unknown as typeof fetch,
		});
		expect(resume).toHaveBeenCalledTimes(1);
		expect(second.failed).toBe(0);
		expect((await fetchImageDownload("crag", "cr1"))?.status).toBe("complete");
	});

	it("stops when cancelled and stays partial", async () => {
		const controller = new AbortController();
		const slow = vi.fn(async () => {
			controller.abort();
			return new Response(new Blob(["x"], { type: "image/webp" }));
		});
		const result = await downloadScopeImages("sub_region", "sr1", {
			signal: controller.signal,
			fetchImpl: slow as unknown as typeof fetch,
		});
		expect(result.cancelled).toBe(true);
		expect((await fetchImageDownload("sub_region", "sr1"))?.status).toBe(
			"partial",
		);
	});

	it("keeps files shared between areas when one area is deleted", async () => {
		await downloadScopeImages("crag", "cr1", { fetchImpl: okFetch });
		await downloadScopeImages("wall", "w1", { fetchImpl: okFetch });
		// w1.webp is referenced by both crag cr1 and wall w1
		await deleteScopeImages("crag", "cr1");
		expect(await readCachedBlob("https://s/w1.webp")).not.toBeNull();
		expect(await readCachedBlob("https://s/r1.webp")).not.toBeNull(); // route image under w1
		expect(await fetchImageDownload("crag", "cr1")).toBeNull();

		await deleteScopeImages("wall", "w1");
		expect(await getCacheStats()).toEqual({ count: 0, bytes: 0 });
	});

	it("unlinks images that left the area on re-fetch", async () => {
		await downloadScopeImages("wall", "w1", { fetchImpl: okFetch });
		sqlite.exec("DELETE FROM route_images_cache WHERE id = 'ri1'");
		await downloadScopeImages("wall", "w1", { fetchImpl: okFetch });
		expect(await readCachedBlob("https://s/r1.webp")).toBeNull();
		expect(await readCachedBlob("https://s/w1.webp")).not.toBeNull();
	});
});

describe("image manager", () => {
	let sqlite: BetterSqlite3.Database;

	beforeEach(async () => {
		sqlite = await setupTestDb();
		setImageFileStore(memoryStore());
		downloadRegion.mockClear();
		seed(sqlite);
	});

	it("reports an update when a new image appears in a downloaded area, and clears it after re-fetch", async () => {
		await downloadScopeImages("crag", "cr1", { fetchImpl: okFetch });
		let [status] = await getAreaImageStatuses();
		expect(status.pendingUpdate).toBeNull();
		expect(status.stats.count).toBe(2);

		sqlite.exec(
			"INSERT INTO route_images_cache (id, route_id, image_url, sort_order, uploaded_by, size_bytes) VALUES ('ri2','r2','https://s/r2.webp',0,'u',200)",
		);
		[status] = await getAreaImageStatuses();
		expect(status.pendingUpdate).toEqual({ added: 1 });

		await downloadScopeImages("crag", "cr1", { fetchImpl: okFetch });
		[status] = await getAreaImageStatuses();
		expect(status.pendingUpdate).toBeNull();
		expect(status.stats.count).toBe(3);
	});

	it("does not report partial areas as updates", async () => {
		const failing = (async () =>
			new Response("x", { status: 500 })) as unknown as typeof fetch;
		await downloadScopeImages("crag", "cr1", { fetchImpl: failing });
		const [status] = await getAreaImageStatuses();
		expect(status.record.status).toBe("partial");
		expect(status.pendingUpdate).toBeNull();
	});

	it("totals storage and splits out personal photos", async () => {
		await downloadScopeImages("wall", "w2", { fetchImpl: okFetch });
		await cacheImage(
			"climb:u/c1/a.webp",
			new Blob(["12345"], { type: "image/webp" }),
			{
				type: "climb",
				id: "c1",
			},
		);
		const overview = await getStorageOverview();
		expect(overview.personal).toEqual({ count: 1, bytes: 5 });
		expect(overview.total.count).toBe(3); // w2 wall image + r3 topo + 1 personal
	});

	it("lists climbs with photos and removing the offline copy keeps pending uploads", async () => {
		sqlite.exec(`
      INSERT INTO climbs (id, user_id, name, grade, offline_available) VALUES ('c1','u','Test Climb','6a',1);
      INSERT INTO climb_images (id, climb_id, user_id, image_url, sort_order, upload_status)
        VALUES ('i1','c1','u','u/c1/a.webp',0,'uploaded'), ('i2','c1','u','u/c1/b.webp',1,'pending');
    `);
		const scope = { type: "climb", id: "c1" };
		await cacheImage(
			"climb:u/c1/a.webp",
			new Blob(["aaa"], { type: "image/webp" }),
			scope,
		);
		await cacheImage(
			"climb:u/c1/b.webp",
			new Blob(["bb"], { type: "image/webp" }),
			scope,
		);

		expect(await listPersonalPhotoClimbs()).toEqual([
			{
				climbId: "c1",
				label: "Test Climb",
				photoCount: 2,
				bytes: 5,
				offlineAvailable: true,
			},
		]);

		await clearClimbImageCache("c1");
		expect(await readCachedBlob("climb:u/c1/a.webp")).toBeNull();
		expect(await readCachedBlob("climb:u/c1/b.webp")).not.toBeNull();
	});
});
