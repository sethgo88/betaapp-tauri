import { z } from "zod";

export const TagSchema = z.object({
	id: z.string(),
	name: z.string(),
	sort_order: z.number(),
});

export type Tag = z.infer<typeof TagSchema>;
