import { z } from "zod";

export const UserSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	role: z.enum(["user", "admin"]),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable().optional(),
});

export type User = z.infer<typeof UserSchema>;
