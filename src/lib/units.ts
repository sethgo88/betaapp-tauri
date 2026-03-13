const CM_PER_IN = 2.54;

export function cmToFtIn(cm: number): { ft: number; inches: number } {
	const totalInches = cm / CM_PER_IN;
	const ft = Math.floor(totalInches / 12);
	const inches = Math.round(totalInches % 12);
	return { ft, inches };
}

export function ftInToCm(ft: number, inches: number): number {
	return Math.round((ft * 12 + inches) * CM_PER_IN);
}

export function cmToIn(cm: number): number {
	return Math.round((cm / CM_PER_IN) * 10) / 10;
}

export function inToCm(inches: number): number {
	return Math.round(inches * CM_PER_IN);
}
