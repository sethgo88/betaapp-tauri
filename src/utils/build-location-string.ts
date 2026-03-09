export const buildLocationString = (locations: Array<string | undefined>) => {
	return locations.filter((loc) => loc !== "").join(" > ");
};
