import { z } from "zod";

export const SentStatus = z.enum([
	"project",
	"sent",
	"redpoint",
	"flash",
	"onsight",
]);
export type SentStatus = z.infer<typeof SentStatus>;

export const RouteType = z.enum(["sport", "boulder"]);
export type RouteType = z.infer<typeof RouteType>;

export const ClimbSchema = z.object({
	id: z.string(),
	user_id: z.string(),
	name: z.string().min(1, "Name is required"),
	route_type: RouteType,
	grade: z.string().min(1, "Grade is required"),
	moves: z.string().default("[]"),
	sent_status: SentStatus,
	country: z.string().optional(),
	area: z.string().optional(),
	sub_area: z.string().optional(),
	route_location: z.string().optional(),
	link: z.string().optional(),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable().optional(),
});

export type Climb = z.infer<typeof ClimbSchema>;

export const ClimbFormSchema = z.object({
	name: z.string().min(1, "Name is required"),
	route_type: RouteType,
	grade: z.string().min(1, "Grade is required"),
	moves: z.string().default("[]"),
	sent_status: SentStatus,
	country: z.string().optional(),
	area: z.string().optional(),
	sub_area: z.string().optional(),
	route_location: z.string().optional(),
	link: z.string().optional(),
});

export type ClimbFormValues = z.infer<typeof ClimbFormSchema>;
