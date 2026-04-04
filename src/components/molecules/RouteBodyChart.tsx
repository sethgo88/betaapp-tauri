import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	LabelList,
	XAxis,
	YAxis,
} from "recharts";
import { useAuthStore } from "@/features/auth/auth.store";
import { useGrades } from "@/features/grades/grades.queries";
import { useRouteBodyStats } from "@/features/routes/routes.queries";
import type { RouteBodyStat } from "@/features/routes/routes.schema";

// ── Chart colours (hardcoded — recharts doesn't read CSS vars) ────────────────

const AXIS_COLOR = "#b5a99b";
const GRID_COLOR = "#4a3f34";
const GRADE_COLORS = [
	"#059669",
	"#0891b2",
	"#7c3aed",
	"#d97706",
	"#dc2626",
	"#db2777",
	"#65a30d",
	"#ea580c",
];

const MIN_CLIMBERS = 1;
const BAR_WIDTH = 45; // px per real data bar
const SPACER_WIDTH = 16; // px per grade-group spacer
const Y_AXIS_LEFT = 40; // approx px offset of plot area left edge (yAxis width + margin)

// ── Unit helpers ──────────────────────────────────────────────────────────────

function cmToFtIn(cm: number): string {
	const totalIn = cm / 2.54;
	const ft = Math.floor(totalIn / 12);
	const inches = Math.round(totalIn % 12);
	return `${ft}'${inches}"`;
}

function formatHeight(cm: number, imperial: boolean): string {
	return imperial ? cmToFtIn(cm) : `${cm}cm`;
}

function formatApeFactor(diffCm: number, imperial: boolean): string {
	if (imperial) {
		const inches = Math.round(diffCm / 2.54);
		return inches >= 0 ? `+${inches}"` : `${inches}"`;
	}
	return diffCm >= 0 ? `+${diffCm}` : `${diffCm}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DataRow = {
	comboLabel: string;
	displayLabel: string;
	grade: string;
	count: number;
	isSpacer: false;
};
type SpacerRow = { comboLabel: ""; displayLabel: ""; count: 0; isSpacer: true };
type FlatRow = DataRow | SpacerRow;

interface Props {
	routeId: string;
	routeType: "sport" | "boulder" | "trad";
}

// ── Component ─────────────────────────────────────────────────────────────────

export const RouteBodyChart = ({ routeId, routeType }: Props) => {
	const {
		data: stats = [],
		isLoading,
		isError,
		error,
	} = useRouteBodyStats(routeId);
	const { data: grades = [] } = useGrades(routeType);
	const imperial = useAuthStore((s) => s.user?.default_unit !== "metric");

	const gradeOrder = new Map(grades.map((g) => [g.grade, g.sort_order]));

	const title = (
		<p className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
			Body dimensions vs grade
		</p>
	);

	if (isLoading) {
		return (
			<div className="rounded-[var(--radius-lg)] bg-surface-card border border-card-border shadow-card p-4 flex flex-col gap-3">
				{title}
				<div className="flex justify-center py-4">
					<div className="w-5 h-5 rounded-full border-2 border-accent-primary border-t-transparent animate-spin" />
				</div>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="rounded-[var(--radius-lg)] bg-surface-card border border-card-border shadow-card p-4 flex flex-col gap-3">
				{title}
				<p className="text-text-tertiary text-sm text-center py-4">
					Failed to load data.
				</p>
				<p className="text-red-400 text-xs text-center font-mono break-all">
					{error instanceof Error
						? error.message
						: JSON.stringify(error, null, 2)}
				</p>
			</div>
		);
	}

	const withBoth = stats.filter(
		(s): s is RouteBodyStat & { ape_index_cm: number } =>
			s.height_cm != null && s.ape_index_cm != null,
	);
	const totalClimbers = withBoth.reduce((sum, s) => sum + s.count, 0);

	if (totalClimbers < MIN_CLIMBERS) {
		return (
			<div className="rounded-[var(--radius-lg)] bg-surface-card border border-card-border shadow-card p-4 flex flex-col gap-3">
				{title}
				<p className="text-text-tertiary text-sm text-center py-4">
					Not enough data yet.
				</p>
			</div>
		);
	}

	// ── Grades sorted by difficulty ───────────────────────────────────────────

	const uniqueGrades = [...new Set(withBoth.map((s) => s.grade))].sort(
		(a, b) => (gradeOrder.get(a) ?? 0) - (gradeOrder.get(b) ?? 0),
	);

	const gradeColorMap = new Map(
		uniqueGrades.map((g, i) => [g, GRADE_COLORS[i % GRADE_COLORS.length]]),
	);

	// ── Combos sorted by height then ape factor ───────────────────────────────

	type Combo = { height_cm: number; ape_index_cm: number; label: string };
	const comboMap = new Map<string, Combo>();
	for (const s of withBoth) {
		const key = `${s.height_cm}|${s.ape_index_cm}`;
		if (!comboMap.has(key)) {
			const apeFactor = s.ape_index_cm;
			comboMap.set(key, {
				height_cm: s.height_cm,
				ape_index_cm: s.ape_index_cm,
				label: `${formatHeight(s.height_cm, imperial)} ${formatApeFactor(apeFactor, imperial)}`,
			});
		}
	}
	const sortedCombos = [...comboMap.values()].sort((a, b) =>
		a.height_cm !== b.height_cm
			? a.height_cm - b.height_cm
			: a.ape_index_cm - b.ape_index_cm,
	);

	// ── Flat dataset: one entry per real data point, spacers between grades ───

	const flatData: FlatRow[] = [];
	let spacerCount = 0;

	for (const [gi, grade] of uniqueGrades.entries()) {
		if (gi > 0) {
			flatData.push({
				comboLabel: "",
				displayLabel: "",
				count: 0,
				isSpacer: true,
			});
			spacerCount++;
		}
		const gradeStats = withBoth.filter((s) => s.grade === grade);
		const gradeCombos = sortedCombos.filter((c) =>
			gradeStats.some(
				(s) => s.height_cm === c.height_cm && s.ape_index_cm === c.ape_index_cm,
			),
		);
		for (const combo of gradeCombos) {
			const stat = gradeStats.find(
				(s) =>
					s.height_cm === combo.height_cm &&
					s.ape_index_cm === combo.ape_index_cm,
			);
			if (stat) {
				flatData.push({
					comboLabel: combo.label,
					displayLabel: combo.label,
					grade,
					count: stat.count,
					isSpacer: false,
				});
			}
		}
	}

	// ── Grade group index ranges for label positioning ────────────────────────

	const gradeGroups = uniqueGrades.map((grade) => {
		const indices = flatData
			.map((r, i) => ({ r, i }))
			.filter(({ r }) => !r.isSpacer && (r as DataRow).grade === grade)
			.map(({ i }) => i);
		return {
			grade,
			startIdx: indices[0] ?? 0,
			endIdx: indices[indices.length - 1] ?? 0,
		};
	});

	const RIGHT_MARGIN = 8;
	const realBars = flatData.filter((r) => !r.isSpacer).length;
	const chartWidth = Math.max(
		300,
		realBars * BAR_WIDTH + spacerCount * SPACER_WIDTH + 60,
	);
	const categoryWidth =
		(chartWidth - Y_AXIS_LEFT - RIGHT_MARGIN) / flatData.length;

	return (
		<div className="rounded-[var(--radius-lg)] bg-surface-card border border-card-border shadow-card p-4 flex flex-col gap-3">
			{title}
			<div className="overflow-x-auto [&_svg]:outline-none [&_svg]:pointer-events-none">
				<div style={{ width: chartWidth }}>
					<BarChart
						width={chartWidth}
						height={220}
						data={flatData}
						barCategoryGap={2}
						margin={{ top: 8, right: RIGHT_MARGIN, left: -20, bottom: 0 }}
						style={{ outline: "none" }}
					>
						<CartesianGrid
							strokeDasharray="3 3"
							stroke={GRID_COLOR}
							vertical={false}
						/>
						<XAxis dataKey="comboLabel" hide />
						<YAxis
							allowDecimals={false}
							tick={{ fill: AXIS_COLOR, fontSize: 10 }}
							axisLine={false}
							tickLine={false}
						/>
						<Bar
							dataKey="count"
							maxBarSize={BAR_WIDTH - 4}
							isAnimationActive={false}
						>
							{flatData.map((entry, i) => (
								<Cell
									key={entry.isSpacer ? `spacer-${i}` : entry.comboLabel}
									fill={
										entry.isSpacer
											? "transparent"
											: (gradeColorMap.get(entry.grade) ?? "#666")
									}
								/>
							))}
							<LabelList
								dataKey="displayLabel"
								content={({ x, y, width, height, value }) => {
									if (
										typeof x !== "number" ||
										typeof y !== "number" ||
										typeof width !== "number" ||
										typeof height !== "number" ||
										!value
									)
										return null;
									if (height < 14) return null;
									return (
										<text
											x={x + width / 2}
											y={y + height - 4}
											textAnchor="middle"
											dominantBaseline="auto"
											fill="#fff"
											fontSize={9}
											fontWeight={600}
										>
											{String(value)}
										</text>
									);
								}}
							/>
						</Bar>
					</BarChart>
					<div style={{ position: "relative", height: 20 }}>
						{gradeGroups.map(({ grade, startIdx, endIdx }) => {
							const cx =
								Y_AXIS_LEFT + ((startIdx + endIdx + 1) / 2) * categoryWidth;
							return (
								<span
									key={grade}
									style={{
										position: "absolute",
										left: cx,
										transform: "translateX(-50%)",
										color: AXIS_COLOR,
										fontSize: 10,
										whiteSpace: "nowrap",
									}}
								>
									{grade}
								</span>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
};
