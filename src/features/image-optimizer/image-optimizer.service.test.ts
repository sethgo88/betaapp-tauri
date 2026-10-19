import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import {
	type ImageGroup,
	type OptimizeBackend,
	planGroups,
	runOptimization,
} from "./image-optimizer.service";

const jpg = (n: number) =>
	new Blob([new Uint8Array(n)], { type: "image/jpeg" });
const webp = (n: number) =>
	new Blob([new Uint8Array(n)], { type: "image/webp" });

const group = (
	path: string,
	sizeBytes: number | null,
	extra: Partial<ImageGroup> = {},
): ImageGroup => ({
	bucket: "route-images",
	path,
	preset: "reference",
	rows: [{ table: "route_images", id: path, sizeBytes }],
	...extra,
});

function fakeBackend(
	groups: ImageGroup[],
	overrides: Partial<OptimizeBackend> = {},
) {
	const calls = {
		upload: [] as string[],
		remove: [] as string[],
		applied: [] as string[],
		sizes: [] as { path: string; size: number }[],
		downloaded: [] as string[],
	};
	const backend: OptimizeBackend = {
		listGroups: async () => groups,
		download: async (_b, path) => {
			calls.downloaded.push(path);
			return jpg(1000);
		},
		upload: async (_b, path) => {
			calls.upload.push(path);
		},
		remove: async (_b, path) => {
			calls.remove.push(path);
		},
		encode: async () => webp(300),
		applyNewFile: async (_g, newPath) => {
			calls.applied.push(newPath);
		},
		recordSize: async (g, size) => {
			calls.sizes.push({ path: g.path, size });
		},
		...overrides,
	};
	return { backend, calls };
}

describe("planGroups", () => {
	it("splits groups into re-encode, size-only and up-to-date", () => {
		expect(
			planGroups([
				group("a.jpg", null),
				group("b.jpeg", 500),
				group("c.webp", null),
				group("d.webp", 200),
			]),
		).toEqual({ total: 4, toReencode: 2, toBackfill: 1, upToDate: 1 });
	});
});

describe("runOptimization", () => {
	it("re-encodes a legacy JPEG as WebP, repoints rows, then deletes the original", async () => {
		const { backend, calls } = fakeBackend([group("routes/r1/a.jpg", null)]);
		const summary = await runOptimization(backend);
		expect(calls.upload).toEqual(["routes/r1/a.webp"]);
		expect(calls.applied).toEqual(["routes/r1/a.webp"]);
		expect(calls.remove).toEqual(["routes/r1/a.jpg"]);
		expect(summary).toMatchObject({
			reencoded: 1,
			sizeBackfilled: 0,
			bytesSaved: 700,
			cancelled: false,
		});
	});

	it("keeps the original and only records its size when re-encoding saves too little", async () => {
		const { backend, calls } = fakeBackend([group("a.jpg", null)], {
			encode: async () => webp(980),
		});
		const summary = await runOptimization(backend);
		expect(calls.upload).toEqual([]);
		expect(calls.remove).toEqual([]);
		expect(calls.sizes).toEqual([{ path: "a.jpg", size: 1000 }]);
		expect(summary.sizeBackfilled).toBe(1);
		expect(summary.reencoded).toBe(0);
	});

	it("falls back to size-only when the WebView cannot encode WebP", async () => {
		const { backend, calls } = fakeBackend([group("a.jpg", null)], {
			encode: async () => jpg(100),
		});
		await runOptimization(backend);
		expect(calls.upload).toEqual([]);
		expect(calls.sizes).toHaveLength(1);
	});

	it("only records size for WebP images and skips fully optimized ones without downloading", async () => {
		const { backend, calls } = fakeBackend([
			group("a.webp", null),
			group("b.webp", 200),
		]);
		const summary = await runOptimization(backend);
		expect(calls.downloaded).toEqual(["a.webp"]);
		expect(calls.sizes).toEqual([{ path: "a.webp", size: 1000 }]);
		expect(summary.sizeBackfilled).toBe(1);
	});

	it("rolls back the new upload and keeps the original if repointing rows fails", async () => {
		const { backend, calls } = fakeBackend([group("a.jpg", null)], {
			applyNewFile: async () => {
				throw new Error("db down");
			},
		});
		const summary = await runOptimization(backend);
		expect(calls.remove).toEqual(["a.webp"]); // only the new file is removed
		expect(summary.reencoded).toBe(0);
		expect(summary.failed).toEqual([{ path: "a.jpg", error: "db down" }]);
	});

	it("continues after a failure and reports progress", async () => {
		const progress: number[] = [];
		const { backend } = fakeBackend(
			[group("bad.jpg", null), group("good.jpg", null)],
			{
				download: async (_b, path) => {
					if (path === "bad.jpg") throw new Error("404");
					return jpg(1000);
				},
			},
		);
		const summary = await runOptimization(backend, {
			onProgress: (p) => progress.push(p.done),
		});
		expect(summary.failed).toHaveLength(1);
		expect(summary.reencoded).toBe(1);
		expect(progress[progress.length - 1]).toBe(2);
	});

	it("stops when cancelled", async () => {
		const controller = new AbortController();
		const { backend } = fakeBackend(
			Array.from({ length: 10 }, (_, i) => group(`p${i}.jpg`, null)),
			{
				download: async () => {
					controller.abort();
					return jpg(1000);
				},
			},
		);
		const summary = await runOptimization(backend, {
			signal: controller.signal,
		});
		expect(summary.cancelled).toBe(true);
		expect(summary.reencoded).toBeLessThan(10);
	});
});
