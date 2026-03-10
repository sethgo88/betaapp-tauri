import { z } from "zod";

export const RouteSchema = z.object({
	id: z.string(),
	wall_id: z.string(),
	name: z.string(),
	grade: z.string(),
	route_type: z.enum(["sport", "boulder"]),
	description: z.string().nullable(),
	verified: z.number(), // 0 = false, 1 = true (SQLite boolean)
	created_by: z.string(),
	created_at: z.string(),
});

export const RouteSubmitSchema = z.object({
	wall_id: z.string().min(1, "Wall is required"),
	name: z.string().min(1, "Name is required"),
	grade: z.string().min(1, "Grade is required"),
	route_type: z.enum(["sport", "boulder"]),
	description: z.string().optional(),
});

export type Route = z.infer<typeof RouteSchema>;
export type RouteSubmitValues = z.infer<typeof RouteSubmitSchema>;
