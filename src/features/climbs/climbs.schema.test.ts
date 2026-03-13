import { describe, expect, it } from "vitest";
import { ClimbFormSchema, ClimbSchema } from "./climbs.schema";

describe("ClimbFormSchema", () => {
	const validForm = {
		name: "Test Route",
		route_type: "sport",
		grade: "6a",
		moves: "[]",
		sent_status: "sent",
	};

	it("parses valid form values", () => {
		const result = ClimbFormSchema.safeParse(validForm);
		expect(result.success).toBe(true);
	});

	it("accepts all valid sent_status values", () => {
		const statuses = ["project", "sent", "redpoint", "flash", "onsight"];
		for (const sent_status of statuses) {
			const result = ClimbFormSchema.safeParse({ ...validForm, sent_status });
			expect(result.success).toBe(true);
		}
	});

	it("accepts both route_type values", () => {
		expect(
			ClimbFormSchema.safeParse({ ...validForm, route_type: "sport" }).success,
		).toBe(true);
		expect(
			ClimbFormSchema.safeParse({ ...validForm, route_type: "boulder" })
				.success,
		).toBe(true);
	});

	it("rejects empty name", () => {
		const result = ClimbFormSchema.safeParse({ ...validForm, name: "" });
		expect(result.success).toBe(false);
	});

	it("rejects empty grade", () => {
		const result = ClimbFormSchema.safeParse({ ...validForm, grade: "" });
		expect(result.success).toBe(false);
	});

	it("rejects invalid route_type", () => {
		const result = ClimbFormSchema.safeParse({
			...validForm,
			route_type: "trad",
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid sent_status", () => {
		const result = ClimbFormSchema.safeParse({
			...validForm,
			sent_status: "topped",
		});
		expect(result.success).toBe(false);
	});

	it("accepts optional fields", () => {
		const result = ClimbFormSchema.safeParse({
			...validForm,
			country: "France",
			area: "Fontainebleau",
			link: "https://example.com",
		});
		expect(result.success).toBe(true);
	});
});

describe("ClimbSchema", () => {
	const validClimb = {
		id: "abc-123",
		user_id: "user-1",
		name: "Test Route",
		route_type: "boulder",
		grade: "V4",
		moves: "[]",
		sent_status: "flash",
		created_at: "2024-01-01T00:00:00",
		updated_at: "2024-01-01T00:00:00",
	};

	it("parses a valid climb record", () => {
		const result = ClimbSchema.safeParse(validClimb);
		expect(result.success).toBe(true);
	});

	it("optional fields may be absent", () => {
		const result = ClimbSchema.safeParse(validClimb);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.country).toBeUndefined();
			expect(result.data.route_id).toBeUndefined();
			expect(result.data.deleted_at).toBeUndefined();
		}
	});

	it("accepts null for nullable fields", () => {
		const result = ClimbSchema.safeParse({
			...validClimb,
			route_id: null,
			deleted_at: null,
		});
		expect(result.success).toBe(true);
	});

	it("rejects missing id", () => {
		const { id: _id, ...withoutId } = validClimb;
		const result = ClimbSchema.safeParse(withoutId);
		expect(result.success).toBe(false);
	});

	it("rejects empty grade", () => {
		const result = ClimbSchema.safeParse({ ...validClimb, grade: "" });
		expect(result.success).toBe(false);
	});
});
