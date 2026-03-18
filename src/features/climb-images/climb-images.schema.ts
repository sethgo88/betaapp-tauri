import { z } from "zod";

export const PinType = z.enum(["lh", "rh", "lf", "rf", "body", "clip"]);
export type PinType = z.infer<typeof PinType>;

export const PointerDir = z.enum(["top", "bottom", "left", "right"]);
export type PointerDir = z.infer<typeof PointerDir>;

export const ClimbImageSchema = z.object({
	id: z.string(),
	climb_id: z.string(),
	user_id: z.string(),
	image_url: z.string(),
	sort_order: z.number(),
	created_at: z.string(),
	deleted_at: z.string().nullable().optional(),
});

export type ClimbImage = z.infer<typeof ClimbImageSchema>;

// ClimbImageWithUrl extends ClimbImage with a resolved signed URL for display.
// image_url holds the storage path; signed_url holds the short-lived display URL.
export type ClimbImageWithUrl = ClimbImage & { signed_url: string };

export const ClimbImagePinSchema = z.object({
	id: z.string(),
	climb_image_id: z.string(),
	pin_type: PinType,
	x_pct: z.number(),
	y_pct: z.number(),
	description: z.string().nullable().optional(),
	pointer_dir: PointerDir.default("bottom"),
	sort_order: z.number(),
	created_at: z.string(),
});

export type ClimbImagePin = z.infer<typeof ClimbImagePinSchema>;
