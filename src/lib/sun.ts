export type SunExposure = "full-sun" | "partial-shade" | "full-shade";
export type Aspect = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type SunData = {
	aspect?: Aspect;
	/**
	 * Per-month exposure. `am` and `pm` are independent — if only one is set,
	 * the unset half inherits that value (i.e. it applies all day).
	 */
	monthly?: { month: Month; am?: SunExposure; pm?: SunExposure }[];
	notes?: string;
};

const EXPOSURE_LABELS: Record<SunExposure, string> = {
	"full-sun": "Full sun",
	"partial-shade": "Partial shade",
	"full-shade": "Full shade",
};

export function summarizeSunData(data: SunData): string {
	const parts: string[] = [];
	if (data.aspect) parts.push(`Faces ${data.aspect}`);
	if (data.monthly?.length) {
		const counts: Partial<Record<SunExposure, number>> = {};
		for (const { am, pm } of data.monthly) {
			if (am) counts[am] = (counts[am] ?? 0) + 1;
			if (pm) counts[pm] = (counts[pm] ?? 0) + 1;
		}
		const dominant = (Object.entries(counts) as [SunExposure, number][]).sort(
			(a, b) => b[1] - a[1],
		)[0]?.[0];
		if (dominant) parts.push(EXPOSURE_LABELS[dominant]);
	}
	if (data.notes) parts.push(data.notes);
	return parts.join(" · ");
}

export function getEffectiveSunData(
	route: { sun_data?: SunData | null },
	wall: { sun_data?: SunData | null },
): SunData | null {
	return route.sun_data ?? wall.sun_data ?? null;
}
