import { z } from "zod/v4";

export const RouteImageSchema = z.object({
	id: z.string(),
	route_id: z.string(),
	image_url: z.string(),
	sort_order: z.number().int(),
	uploaded_by: z.string(),
	created_at: z.string(),
});
export type RouteImage = z.infer<typeof RouteImageSchema>;

export const WallImageSchema = z.object({
	id: z.string(),
	wall_id: z.string(),
	image_url: z.string(),
	sort_order: z.number().int(),
	uploaded_by: z.string(),
	created_at: z.string(),
});
export type WallImage = z.infer<typeof WallImageSchema>;
