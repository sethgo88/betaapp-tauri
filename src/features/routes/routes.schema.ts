import { z } from "zod";
import type { SunData } from "@/lib/sun";

export const SubmissionStatus = z.enum(["pending", "verified", "rejected"]);
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;

export const RouteSchema = z.object({
	id: z.string(),
	wall_id: z.string(),
	name: z.string(),
	grade: z.string(),
	route_type: z.enum(["sport", "boulder", "trad"]),
	description: z.string().nullable(),
	status: SubmissionStatus,
	created_by: z.string(),
	created_at: z.string(),
	sort_order: z.number().int().default(0),
	avg_rating: z.number().nullable().optional(),
	rating_count: z.number().int().default(0),
	sun_data: z.custom<SunData | null>().optional(),
});

export const RouteSubmitSchema = z.object({
	wall_id: z.string().min(1, "Wall is required"),
	name: z.string().min(1, "Name is required"),
	grade: z.string().min(1, "Grade is required"),
	route_type: z.enum(["sport", "boulder", "trad"]),
	description: z.string().optional(),
});

export type Route = z.infer<typeof RouteSchema>;
export type RouteSubmitValues = z.infer<typeof RouteSubmitSchema>;

export const RouteLinkSchema = z.object({
	id: z.string(),
	route_id: z.string(),
	user_id: z.string(),
	url: z.string(),
	title: z.string().nullable(),
	link_type: z.string(),
	created_at: z.string(),
	deleted_at: z.string().nullable(),
});

export const RouteLinkSubmitSchema = z.object({
	url: z
		.string()
		.min(1, "URL is required")
		.regex(/^https?:\/\//, "URL must start with http:// or https://"),
	title: z.string().optional(),
});

export type RouteLink = z.infer<typeof RouteLinkSchema>;
export type RouteLinkSubmitValues = z.infer<typeof RouteLinkSubmitSchema>;

// Returned by the get_route_body_stats Supabase RPC
export type RouteBodyStat = {
	height_cm: number;
	ape_index_cm: number | null;
	grade: string;
	count: number;
};
