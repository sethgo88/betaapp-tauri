import { z } from "zod";

export const BurnSchema = z.object({
	id: z.string(),
	climb_id: z.string(),
	user_id: z.string(),
	date: z.string(),
	outcome: z.string(),
	notes: z.string().nullable().optional(),
	feel: z.number().int().min(0).max(5).nullable().optional(),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable().optional(),
});

export type Burn = z.infer<typeof BurnSchema>;

export const BurnFormSchema = z.object({
	date: z.string().min(1, "Date is required"),
	notes: z.string().optional(),
	feel: z.number().int().min(0).max(5).nullable().optional(),
});

export type BurnFormValues = z.infer<typeof BurnFormSchema>;
