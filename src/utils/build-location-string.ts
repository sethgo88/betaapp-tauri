export const buildLocationString = (
	locations: Array<string | null | undefined>,
) => {
	return locations.filter((loc) => loc != null && loc !== "").join(" > ");
};
