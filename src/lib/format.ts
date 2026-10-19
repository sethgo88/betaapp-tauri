/** Human-readable byte size, e.g. 1536 → "1.5 KB". */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
	const mb = kb / 1024;
	if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
	return `${(mb / 1024).toFixed(1)} GB`;
}
