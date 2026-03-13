import { beforeEach, describe, expect, it } from "vitest";
import { setupTestDb } from "@/test/setup-db";
import {
	fetchClimb,
	fetchClimbs,
	insertClimb,
	softDeleteClimb,
	updateClimb,
} from "./climbs.service";
import type { ClimbFormValues } from "./climbs.schema";

const USER_A = "user-a";
const USER_B = "user-b";

const baseClimb: ClimbFormValues = {
	name: "Test Route",
	route_type: "sport",
	grade: "6a",
	moves: "[]",
	sent_status: "sent",
};

describe("climbs.service", () => {
	beforeEach(async () => {
		await setupTestDb();
	});

	it("inserts and fetches a climb", async () => {
		await insertClimb(USER_A, baseClimb);

		const climbs = await fetchClimbs(USER_A);
		expect(climbs).toHaveLength(1);
		expect(climbs[0].name).toBe("Test Route");
		expect(climbs[0].grade).toBe("6a");
		expect(climbs[0].user_id).toBe(USER_A);
	});

	it("fetchClimb returns the correct climb by id", async () => {
		await insertClimb(USER_A, baseClimb);
		const all = await fetchClimbs(USER_A);

		const found = await fetchClimb(all[0].id);
		expect(found).not.toBeNull();
		expect(found?.name).toBe("Test Route");
	});

	it("fetchClimb returns null for unknown id", async () => {
		const found = await fetchClimb("nonexistent");
		expect(found).toBeNull();
	});

	it("fetchClimbs only returns the requesting user's climbs", async () => {
		await insertClimb(USER_A, baseClimb);
		await insertClimb(USER_B, { ...baseClimb, name: "Other Route" });

		const climbs = await fetchClimbs(USER_A);
		expect(climbs).toHaveLength(1);
		expect(climbs[0].name).toBe("Test Route");
	});

	it("updates a climb", async () => {
		await insertClimb(USER_A, baseClimb);
		const [climb] = await fetchClimbs(USER_A);

		await updateClimb(climb.id, {
			...baseClimb,
			name: "Updated Route",
			grade: "7a",
		});

		const updated = await fetchClimb(climb.id);
		expect(updated?.name).toBe("Updated Route");
		expect(updated?.grade).toBe("7a");
	});

	it("soft-deletes a climb — excluded from fetch results", async () => {
		await insertClimb(USER_A, baseClimb);
		const [climb] = await fetchClimbs(USER_A);

		await softDeleteClimb(climb.id);

		const afterDelete = await fetchClimbs(USER_A);
		expect(afterDelete).toHaveLength(0);

		const byId = await fetchClimb(climb.id);
		expect(byId).toBeNull();
	});

	it("multiple inserts all appear in fetchClimbs", async () => {
		await insertClimb(USER_A, { ...baseClimb, name: "Route 1" });
		await insertClimb(USER_A, { ...baseClimb, name: "Route 2" });
		await insertClimb(USER_A, { ...baseClimb, name: "Route 3" });

		const climbs = await fetchClimbs(USER_A);
		expect(climbs).toHaveLength(3);
		const names = climbs.map((c) => c.name);
		expect(names).toContain("Route 1");
		expect(names).toContain("Route 2");
		expect(names).toContain("Route 3");
	});
});
