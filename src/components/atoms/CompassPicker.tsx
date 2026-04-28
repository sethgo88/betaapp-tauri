import type { Aspect } from "@/lib/sun";

// ── Geometry constants ────────────────────────────────────────────────────────

const CX = 100;
const CY = 100;
const OUTER_R = 92;
const INNER_R = 46;
const LABEL_R = (OUTER_R + INNER_R) / 2; // midpoint of the ring
const HALF_SPAN_DEG = 45 / 2 - 1; // 21.5° — 1° gap on each side

function toRad(deg: number) {
	return (deg * Math.PI) / 180;
}

function segmentPath(startDeg: number, endDeg: number): string {
	const s = toRad(startDeg);
	const e = toRad(endDeg);
	const x1 = CX + OUTER_R * Math.cos(s);
	const y1 = CY + OUTER_R * Math.sin(s);
	const x2 = CX + OUTER_R * Math.cos(e);
	const y2 = CY + OUTER_R * Math.sin(e);
	const x3 = CX + INNER_R * Math.cos(e);
	const y3 = CY + INNER_R * Math.sin(e);
	const x4 = CX + INNER_R * Math.cos(s);
	const y4 = CY + INNER_R * Math.sin(s);
	return `M${x1},${y1} A${OUTER_R},${OUTER_R} 0 0 1 ${x2},${y2} L${x3},${y3} A${INNER_R},${INNER_R} 0 0 0 ${x4},${y4} Z`;
}

// Pre-computed segment data — no runtime trig
const DIRECTIONS: Aspect[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

const SEGMENTS = DIRECTIONS.map((dir, i) => {
	const centreDeg = -90 + i * 45;
	const labelRad = toRad(centreDeg);
	return {
		dir,
		path: segmentPath(centreDeg - HALF_SPAN_DEG, centreDeg + HALF_SPAN_DEG),
		labelX: CX + LABEL_R * Math.cos(labelRad),
		labelY: CY + LABEL_R * Math.sin(labelRad),
	};
});

// ── Component ────────────────────────────────────────────────────────────────

interface CompassPickerProps {
	value: Aspect | undefined;
	onChange: (a: Aspect | undefined) => void;
}

export function CompassPicker({ value, onChange }: CompassPickerProps) {
	return (
		<div className="w-full max-w-[220px] mx-auto select-none">
			<svg
				viewBox="0 0 200 200"
				className="w-full h-auto"
				role="img"
				aria-label="Compass direction picker"
			>
				{/* Outer border */}
				<circle
					cx={CX}
					cy={CY}
					r={OUTER_R}
					fill="none"
					stroke="rgba(255,255,255,0.25)"
					strokeWidth={1}
				/>
				{/* Inner border */}
				<circle
					cx={CX}
					cy={CY}
					r={INNER_R}
					fill="none"
					stroke="rgba(255,255,255,0.25)"
					strokeWidth={1}
				/>

				{SEGMENTS.map(({ dir, path, labelX, labelY }) => {
					const selected = value === dir;
					return (
						// biome-ignore lint/a11y/useSemanticElements: SVG g element cannot use HTML button
						<g
							key={dir}
							role="button"
							tabIndex={0}
							aria-pressed={selected}
							aria-label={dir}
							onClick={() => onChange(selected ? undefined : dir)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									onChange(selected ? undefined : dir);
								}
							}}
							style={{ cursor: "pointer", outline: "none" }}
						>
							<path
								d={path}
								style={{
									fill: selected ? "white" : "rgba(255,255,255,0.15)",
									transition: "fill 120ms ease",
								}}
							/>
							<text
								x={labelX}
								y={labelY}
								textAnchor="middle"
								dominantBaseline="middle"
								fontSize={12}
								fontWeight={700}
								fontFamily="var(--font-body)"
								style={{
									fill: selected ? "var(--accent-primary)" : "white",
									transition: "fill 120ms ease",
									pointerEvents: "none",
									userSelect: "none",
								}}
							>
								{dir}
							</text>
						</g>
					);
				})}
			</svg>
		</div>
	);
}
