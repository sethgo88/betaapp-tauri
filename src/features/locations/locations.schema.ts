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

export type Country = z.infer<typeof CountrySchema>;
export type Region = z.infer<typeof RegionSchema>;
