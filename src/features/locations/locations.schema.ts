import { z } from "zod";
import { SubmissionStatus } from "@/features/routes/routes.schema";
import type { SunData } from "@/lib/sun";

export const WallType = z.enum(["wall", "boulder"]);
export type WallType = z.infer<typeof WallType>;

export const CountrySchema = z.object({
	id: z.string(),
	name: z.string(),
	code: z.string().default(""),
	sort_order: z.number(),
	created_at: z.string(),
	region_count: z.number().default(0),
});

export const RegionSchema = z.object({
	id: z.string(),
	country_id: z.string(),
	name: z.string(),
	sort_order: z.number(),
	created_at: z.string(),
	sub_region_count: z.number().default(0),
});

export const SubRegionSchema = z.object({
	id: z.string(),
	region_id: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	sort_order: z.number(),
	status: SubmissionStatus.default("verified"),
	created_by: z.string().nullable().optional(),
	created_at: z.string(),
	crag_count: z.number().default(0),
});

export const CragSchema = z.object({
	id: z.string(),
	sub_region_id: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	approach: z.string().nullable().optional(),
	sort_order: z.number(),
	status: SubmissionStatus.default("verified"),
	created_by: z.string().nullable().optional(),
	created_at: z.string(),
	lat: z.number().nullable().optional(),
	lng: z.number().nullable().optional(),
	sport_count: z.number().default(0),
	trad_count: z.number().default(0),
	boulder_count: z.number().default(0),
	wall_count: z.number().default(0),
});

export const WallSchema = z.object({
	id: z.string(),
	crag_id: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	approach: z.string().nullable().optional(),
	sort_order: z.number(),
	status: SubmissionStatus.default("verified"),
	created_by: z.string().nullable().optional(),
	created_at: z.string(),
	lat: z.number().nullable().optional(),
	lng: z.number().nullable().optional(),
	wall_type: WallType.default("wall"),
	sport_count: z.number().default(0),
	trad_count: z.number().default(0),
	boulder_count: z.number().default(0),
	route_count: z.number().default(0),
	sun_data: z.custom<SunData | null>().optional(),
});

export type Country = z.infer<typeof CountrySchema>;
export type Region = z.infer<typeof RegionSchema>;
export type SubRegion = z.infer<typeof SubRegionSchema>;
export type Crag = z.infer<typeof CragSchema>;
export type Wall = z.infer<typeof WallSchema>;

// ── User submission schemas ───────────────────────────────────────────────────

export const SubRegionSubmitSchema = z.object({
	region_id: z.string().min(1, "Region is required"),
	name: z.string().min(1, "Name is required"),
});

export const CragSubmitSchema = z.object({
	sub_region_id: z.string().min(1, "Sub-region is required"),
	name: z.string().min(1, "Name is required"),
	lat: z.number().optional(),
	lng: z.number().optional(),
});

export const WallSubmitSchema = z.object({
	crag_id: z.string().min(1, "Crag is required"),
	name: z.string().min(1, "Name is required"),
	wall_type: WallType.default("wall"),
	lat: z.number().optional(),
	lng: z.number().optional(),
});

export type SubRegionSubmitValues = z.infer<typeof SubRegionSubmitSchema>;
export type CragSubmitValues = z.infer<typeof CragSubmitSchema>;
export type WallSubmitValues = z.infer<typeof WallSubmitSchema>;

// ── Admin pending-location type ───────────────────────────────────────────────

export type PendingLocationType = "sub_region" | "crag" | "wall";

export type PendingLocation = {
	id: string;
	name: string;
	type: PendingLocationType;
	created_by: string;
	created_at: string;
	// Breadcrumb context
	parent_name: string;
	region_name?: string;
};
