import { z } from "zod";

export const MoveItem = z.object({
	id: z.string(),
	text: z.string(),
});
export type MoveItem = z.infer<typeof MoveItem>;

export const Beta = z.object({
	id: z.string(),
	title: z.string(),
	moves: z.array(MoveItem),
});
export type Beta = z.infer<typeof Beta>;

export const BetasSchema = z.array(Beta);
export type Betas = z.infer<typeof BetasSchema>;

/**
 * Parse the `moves` JSON string from a climb record into an array of betas.
 *
 * Handles:
 *   - New format: [{id, title, moves: [{id, text}]}]
 *   - Legacy format: [{id, text}] → wrapped as "Beta 1"
 *   - Empty / invalid → returns []
 *
 * Empty-text moves are filtered out.
 */
export function parseBetas(movesJson: string): Beta[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(movesJson);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed) || parsed.length === 0) return [];

	// New betas format
	const betasResult = BetasSchema.safeParse(parsed);
	if (betasResult.success) {
		return betasResult.data.map((beta) => ({
			...beta,
			moves: beta.moves.filter((m) => m.text.trim() !== ""),
		}));
	}

	// Legacy flat moves format
	const legacyResult = z.array(MoveItem).safeParse(parsed);
	if (legacyResult.success) {
		const nonEmpty = legacyResult.data.filter((m) => m.text.trim() !== "");
		if (nonEmpty.length > 0) {
			return [{ id: crypto.randomUUID(), title: "Beta 1", moves: nonEmpty }];
		}
	}

	return [];
}

export const SentStatus = z.enum([
	"todo",
	"project",
	"sent",
	"redpoint",
	"flash",
	"onsight",
]);
export type SentStatus = z.infer<typeof SentStatus>;

export const RouteType = z.enum(["sport", "boulder", "trad"]);
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
	crag: z.string().optional(),
	wall: z.string().optional(),
	route_location: z.string().optional(),
	link: z.string().optional(),
	route_id: z.string().nullable().optional(),
	sent_date: z.string().nullable().optional(),
	rating: z.number().int().min(1).max(5).nullable().optional(),
	created_at: z.string(),
	updated_at: z.string(),
	deleted_at: z.string().nullable().optional(),
	offline_available: z.number().int().default(0),
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
	crag: z.string().optional(),
	wall: z.string().optional(),
	route_location: z.string().optional(),
	link: z.string().optional(),
	sent_date: z.string().nullable().optional(),
	rating: z.number().int().min(1).max(5).nullable().optional(),
});

export type ClimbFormValues = z.infer<typeof ClimbFormSchema>;

export const ClimbLinkSchema = z.object({
	id: z.string(),
	climb_id: z.string(),
	user_id: z.string(),
	url: z.string(),
	title: z.string().nullable(),
	link_type: z.string(),
	created_at: z.string(),
	deleted_at: z.string().nullable(),
});

export type ClimbLink = z.infer<typeof ClimbLinkSchema>;
