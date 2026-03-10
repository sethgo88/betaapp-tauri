import { z } from "zod";

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
	sort_order: z.number(),
	created_at: z.string(),
});

export const CragSchema = z.object({
	id: z.string(),
	sub_region_id: z.string(),
	name: z.string(),
	sort_order: z.number(),
	created_at: z.string(),
});

export const WallSchema = z.object({
	id: z.string(),
	crag_id: z.string(),
	name: z.string(),
	sort_order: z.number(),
	created_at: z.string(),
});

export type Country = z.infer<typeof CountrySchema>;
export type Region = z.infer<typeof RegionSchema>;
export type SubRegion = z.infer<typeof SubRegionSchema>;
export type Crag = z.infer<typeof CragSchema>;
export type Wall = z.infer<typeof WallSchema>;
