import { z } from "zod/v4";

export const PointSchema = z.object({
	x_pct: z.number().min(0).max(1),
	y_pct: z.number().min(0).max(1),
});
export type Point = z.infer<typeof PointSchema>;

export const WallTopoSchema = z.object({
	id: z.string(),
	wall_id: z.string(),
	image_url: z.string(),
	created_by: z.string().nullable(),
	created_at: z.string(),
});
export type WallTopo = z.infer<typeof WallTopoSchema>;

export const WallTopoLineSchema = z.object({
	id: z.string(),
	topo_id: z.string(),
	route_id: z.string(),
	points: z.array(PointSchema),
	color: z.string(),
	sort_order: z.number(),
	created_at: z.string(),
});
export type WallTopoLine = z.infer<typeof WallTopoLineSchema>;

export const RouteTopoSchema = z.object({
	id: z.string(),
	route_id: z.string(),
	image_url: z.string(),
	points: z.array(PointSchema),
	color: z.string(),
	created_by: z.string().nullable(),
	created_at: z.string(),
});
export type RouteTopo = z.infer<typeof RouteTopoSchema>;

/** Fixed color palette — assigned by route sort_order index mod palette length */
export const TOPO_COLORS = [
	"#EF4444",
	"#F97316",
	"#EAB308",
	"#22C55E",
	"#06B6D4",
	"#6366F1",
	"#EC4899",
	"#A78BFA",
] as const;

export function topoColor(index: number): string {
	return TOPO_COLORS[index % TOPO_COLORS.length];
}
