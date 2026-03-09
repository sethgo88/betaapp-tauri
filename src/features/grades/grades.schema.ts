import { z } from "zod";

export const GradeSchema = z.object({
	id: z.string(),
	discipline: z.enum(["sport", "boulder"]),
	grade: z.string(),
	sort_order: z.number(),
	created_at: z.string(),
});

export type Grade = z.infer<typeof GradeSchema>;
