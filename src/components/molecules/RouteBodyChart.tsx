import { useState } from "react";
import {
	CartesianGrid,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
	ZAxis,
} from "recharts";
import { ToggleGroup } from "@/components/atoms/ToggleGroup";
import { useGrades } from "@/features/grades/grades.queries";
import { useRouteBodyStats } from "@/features/routes/routes.queries";

// ── Chart colours (hardcoded — recharts doesn't read CSS vars) ────────────────

const COLOR_SENT = "#059669";
const AXIS_COLOR = "#b5a99b";
const GRID_COLOR = "#4a3f34";
const TOOLTIP_BG = "#2a2420";
const TOOLTIP_BORDER = "#4a3f34";

// Minimum number of climbers (sum of counts) required to show the chart
const MIN_CLIMBERS = 5;

type XMetric = "height" | "ape_index";

interface Props {
	routeId: string;
	routeType: "sport" | "boulder";
}

export const RouteBodyChart = ({ routeId, routeType }: Props) => {
	const [xMetric, setXMetric] = useState<XMetric>("height");
	const { data: stats = [], isLoading } = useRouteBodyStats(routeId);
	const { data: grades = [] } = useGrades(routeType);

	const gradeOrder = new Map(grades.map((g) => [g.grade, g.sort_order]));
	const gradeByOrder = new Map(grades.map((g) => [g.sort_order, g.grade]));

	const filtered = stats.filter((s) =>
		xMetric === "height" ? s.height_cm != null : s.ape_index_cm != null,
	);
	const totalClimbers = filtered.reduce((sum, s) => sum + s.count, 0);

	const title = (
		<p className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
			Body dimensions vs grade
		</p>
	);

	if (isLoading) return null;

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

	const chartData = filtered.map((s) => ({
		x: xMetric === "height" ? s.height_cm : (s.ape_index_cm ?? 0),
		y: gradeOrder.get(s.grade) ?? 0,
		z: s.count,
		grade: s.grade,
		count: s.count,
	}));

	const uniqueGrades = [...new Set(filtered.map((s) => s.grade))].sort(
		(a, b) => (gradeOrder.get(a) ?? 0) - (gradeOrder.get(b) ?? 0),
	);
	const yTicks = uniqueGrades.map((g) => gradeOrder.get(g) ?? 0);
	const yMin = Math.min(...yTicks) - 1;
	const yMax = Math.max(...yTicks) + 1;

	return (
		<div className="rounded-[var(--radius-lg)] bg-surface-card border border-card-border shadow-card p-4 flex flex-col gap-3">
			{title}
			<ToggleGroup
				options={[
					{ value: "height", label: "Height" },
					{ value: "ape_index", label: "Ape index" },
				]}
				value={xMetric}
				onChange={(v) => setXMetric(v as XMetric)}
			/>
			<ResponsiveContainer width="100%" height={220}>
				<ScatterChart margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
					<CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
					<XAxis
						type="number"
						dataKey="x"
						name={xMetric === "height" ? "Height" : "Ape index"}
						unit="cm"
						tick={{ fill: AXIS_COLOR, fontSize: 10 }}
						axisLine={false}
						tickLine={false}
					/>
					<YAxis
						type="number"
						dataKey="y"
						name="Grade"
						domain={[yMin, yMax]}
						ticks={yTicks}
						tickFormatter={(v: number) => gradeByOrder.get(v) ?? String(v)}
						tick={{ fill: AXIS_COLOR, fontSize: 10 }}
						axisLine={false}
						tickLine={false}
					/>
					<ZAxis type="number" dataKey="z" range={[40, 400]} name="Climbers" />
					<Tooltip
						cursor={{ strokeDasharray: "3 3" }}
						content={({ payload }) => {
							if (!payload?.length) return null;
							const d = payload[0]?.payload as (typeof chartData)[0];
							if (!d) return null;
							return (
								<div
									style={{
										backgroundColor: TOOLTIP_BG,
										border: `1px solid ${TOOLTIP_BORDER}`,
										borderRadius: "0.5rem",
										color: "#f5f0eb",
										fontSize: "0.75rem",
										padding: "8px 12px",
									}}
								>
									<p style={{ fontWeight: 600 }}>{d.grade}</p>
									<p>
										{xMetric === "height" ? "Height" : "Ape index"}: {d.x}cm
									</p>
									<p>
										{d.count} climber{d.count !== 1 ? "s" : ""}
									</p>
								</div>
							);
						}}
					/>
					<Scatter data={chartData} fill={COLOR_SENT} fillOpacity={0.75} />
				</ScatterChart>
			</ResponsiveContainer>
		</div>
	);
};
