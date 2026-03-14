import { z } from "zod";
import { SubmissionStatus } from "@/features/routes/routes.schema";

export const CountrySchema = z.object({
	id: z.string(),
	name: z.string(),
	code: z.string(),
	sort_order: z.number(),
	created_at: z.string(),
});

export const RegionSchema = z.object({
	id: z.string(),
	country_id: z.string(),
	name: z.string(),
	sort_order: z.number(),
	created_at: z.string(),
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
});

export const CragSchema = z.object({
	id: z.string(),
	sub_region_id: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	sort_order: z.number(),
	status: SubmissionStatus.default("verified"),
	created_by: z.string().nullable().optional(),
	created_at: z.string(),
	lat: z.number().nullable().optional(),
	lng: z.number().nullable().optional(),
});

export const WallSchema = z.object({
	id: z.string(),
	crag_id: z.string(),
	name: z.string(),
	description: z.string().nullable().optional(),
	sort_order: z.number(),
	status: SubmissionStatus.default("verified"),
	created_by: z.string().nullable().optional(),
	created_at: z.string(),
	lat: z.number().nullable().optional(),
	lng: z.number().nullable().optional(),
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
