import { z } from "zod";

export const UnitPreference = z.enum(["imperial", "metric"]);
export type UnitPreference = z.infer<typeof UnitPreference>;

export const UserSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	role: z.enum(["user", "admin"]),
	display_name: z.string().nullable().optional(),
	height_cm: z.number().nullable().optional(),
	ape_index_cm: z.number().nullable().optional(),
	max_redpoint_sport: z.string().nullable().optional(),
	max_redpoint_boulder: z.string().nullable().optional(),
	default_unit: UnitPreference.default("imperial"),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable().optional(),
});

export type User = z.infer<typeof UserSchema>;
