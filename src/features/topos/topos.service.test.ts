import type BetterSqlite3 from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { setupTestDb } from "@/test/setup-db";
import { pruneCacheRows } from "./topos.service";

describe("pruneCacheRows", () => {
	let sqlite: BetterSqlite3.Database;

	beforeEach(async () => {
		sqlite = await setupTestDb();
		sqlite.exec(`
      INSERT INTO route_images_cache (id, route_id, image_url, sort_order, uploaded_by)
        VALUES ('a','r1','https://s/a.webp',0,'u'), ('b','r1','https://s/b.webp',1,'u');
    `);
	});

	const ids = () =>
		(
			sqlite.prepare("SELECT id FROM route_images_cache ORDER BY id").all() as {
				id: string;
			}[]
		).map((r) => r.id);

	it("deletes cache rows that no longer exist on the server", async () => {
		await pruneCacheRows("route_images_cache", ["a"]);
		expect(ids()).toEqual(["a"]);
	});

	it("prunes nothing when the server returned no rows", async () => {
		await pruneCacheRows("route_images_cache", []);
		expect(ids()).toEqual(["a", "b"]);
	});
});
