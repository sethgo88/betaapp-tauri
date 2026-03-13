import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock supabase before any module that imports it is loaded.
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

import { setupTestDb } from "@/test/setup-db";
import { fetchGrades } from "./grades.service";
import type BetterSqlite3 from "better-sqlite3";

function seedGrades(sqlite: BetterSqlite3.Database): void {
	const insert = sqlite.prepare(
		"INSERT INTO grades_cache (id, discipline, grade, sort_order, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
	);
	insert.run("g1", "sport", "5a", 10);
	insert.run("g2", "sport", "6a", 20);
	insert.run("g3", "sport", "7a", 30);
	insert.run("g4", "boulder", "V3", 10);
	insert.run("g5", "boulder", "V5", 20);
}

describe("grades.service", () => {
	let sqlite: BetterSqlite3.Database;

	beforeEach(async () => {
		sqlite = await setupTestDb();
		seedGrades(sqlite);
	});

	it("fetches sport grades in sort_order ascending", async () => {
		const grades = await fetchGrades("sport");
		expect(grades).toHaveLength(3);
		expect(grades.map((g) => g.grade)).toEqual(["5a", "6a", "7a"]);
	});

	it("fetches boulder grades filtered by discipline", async () => {
		const grades = await fetchGrades("boulder");
		expect(grades).toHaveLength(2);
		expect(grades.map((g) => g.grade)).toEqual(["V3", "V5"]);
	});

	it("returns empty array when no grades seeded for discipline", async () => {
		// Clear grades
		sqlite.prepare("DELETE FROM grades_cache").run();
		const grades = await fetchGrades("sport");
		expect(grades).toHaveLength(0);
	});
});
