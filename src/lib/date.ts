/**
 * Format a date value for display.
 *
 * @param date - A Date object, ISO timestamp string, or YYYY-MM-DD date string.
 * @param format - Format string using tokens DD, MM, YY, YYYY. Defaults to 'DD-MM-YY'.
 * @returns Formatted date string.
 *
 * @example
 * formatDate('2025-03-05')              // '05-03-25'
 * formatDate('2025-03-05', 'DD/MM/YYYY') // '05/03/2025'
 * formatDate(new Date(), 'MM-DD-YY')    // e.g. '03-05-25'
 */
export function formatDate(date: string | Date, format = "DD-MM-YY"): string {
	let d: Date;

	if (date instanceof Date) {
		d = date;
	} else if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		// Date-only string — parse as local time to avoid UTC offset shifting the day
		const [year, month, day] = date.split("-").map(Number);
		d = new Date(year, month - 1, day);
	} else {
		d = new Date(date);
	}

	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const yyyy = String(d.getFullYear());
	const yy = yyyy.slice(-2);

	return format
		.replace("YYYY", yyyy)
		.replace("DD", dd)
		.replace("MM", mm)
		.replace("YY", yy);
}
