import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Spinner } from "@/components/atoms/Spinner";
import { ToggleGroup } from "@/components/atoms/ToggleGroup";
import { useClimbStats } from "@/features/climbs/climbs.queries";
import type { Discipline } from "@/features/climbs/climbs.stats";

// ── Chart colours (hardcoded — recharts doesn't read CSS vars) ────────────────

const COLOR_SENT = "#0d9488"; // matches --accent-primary token
const COLOR_PROJECT = "#d97706";
const COLOR_TODO = "#8a7e72";
const AXIS_COLOR = "#b5a99b";
const GRID_COLOR = "#4a3f34";
const TOOLTIP_BG = "#2a2420";
const TOOLTIP_BORDER = "#4a3f34";

// ── Shared tooltip style ──────────────────────────────────────────────────────

const tooltipStyle = {
	backgroundColor: TOOLTIP_BG,
	border: `1px solid ${TOOLTIP_BORDER}`,
	borderRadius: "0.5rem",
	color: "#f5f0eb",
	fontSize: "0.75rem",
};

// ── Chart section wrapper ─────────────────────────────────────────────────────

const ChartCard = ({
	title,
	children,
	empty,
}: {
	title: string;
	children: React.ReactNode;
	empty?: boolean;
}) => (
	<div className="rounded-lg bg-surface-card p-4 flex flex-col gap-3">
		<p className="text-sm font-semibold text-text-on-light uppercase tracking-wide">
			{title}
		</p>
		{empty ? (
			<p className="text-text-on-light/60 text-sm text-center py-4">
				Not enough data yet.
			</p>
		) : (
			children
		)}
	</div>
);

// ── Grade distribution chart ──────────────────────────────────────────────────

const GradeDistributionChart = ({
	data,
}: {
	data: { grade: string; sent: number; project: number; todo: number }[];
}) => (
	<ResponsiveContainer width="100%" height={200}>
		<BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
			<CartesianGrid
				strokeDasharray="3 3"
				stroke={GRID_COLOR}
				vertical={false}
			/>
			<XAxis
				dataKey="grade"
				tick={{ fill: AXIS_COLOR, fontSize: 10 }}
				axisLine={false}
				tickLine={false}
				interval={0}
				angle={-35}
				textAnchor="end"
				height={40}
			/>
			<YAxis
				tick={{ fill: AXIS_COLOR, fontSize: 10 }}
				axisLine={false}
				tickLine={false}
				allowDecimals={false}
			/>
			<Tooltip
				contentStyle={tooltipStyle}
				cursor={{ fill: "rgba(255,255,255,0.04)" }}
			/>
			<Legend
				wrapperStyle={{
					fontSize: "0.7rem",
					color: AXIS_COLOR,
					paddingTop: "4px",
				}}
			/>
			<Bar
				dataKey="sent"
				stackId="a"
				fill={COLOR_SENT}
				name="Sent"
				radius={[0, 0, 0, 0]}
			/>
			<Bar
				dataKey="project"
				stackId="a"
				fill={COLOR_PROJECT}
				name="Project"
				radius={[0, 0, 0, 0]}
			/>
			<Bar
				dataKey="todo"
				stackId="a"
				fill={COLOR_TODO}
				name="Todo"
				radius={[3, 3, 0, 0]}
			/>
		</BarChart>
	</ResponsiveContainer>
);

// ── Sends per month chart ─────────────────────────────────────────────────────

const MonthLabel = ({ month }: { month: string }) => {
	const [y, m] = month.split("-");
	return `${m}/${y.slice(2)}`;
};

const SendsPerMonthChart = ({
	data,
}: {
	data: { month: string; count: number }[];
}) => {
	const displayData = data.map((d) => ({
		...d,
		label: MonthLabel({ month: d.month }),
	}));

	return (
		<ResponsiveContainer width="100%" height={180}>
			<BarChart
				data={displayData}
				margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
			>
				<CartesianGrid
					strokeDasharray="3 3"
					stroke={GRID_COLOR}
					vertical={false}
				/>
				<XAxis
					dataKey="label"
					tick={{ fill: AXIS_COLOR, fontSize: 10 }}
					axisLine={false}
					tickLine={false}
				/>
				<YAxis
					tick={{ fill: AXIS_COLOR, fontSize: 10 }}
					axisLine={false}
					tickLine={false}
					allowDecimals={false}
				/>
				<Tooltip
					contentStyle={tooltipStyle}
					cursor={{ fill: "rgba(255,255,255,0.04)" }}
					formatter={(v) => [v, "Sends"]}
				/>
				<Bar
					dataKey="count"
					fill={COLOR_SENT}
					name="Sends"
					radius={[3, 3, 0, 0]}
				/>
			</BarChart>
		</ResponsiveContainer>
	);
};

// ── Burns per send chart ──────────────────────────────────────────────────────

const BurnsPerSendChart = ({
	data,
}: {
	data: { grade: string; burns_per_send: number }[];
}) => (
	<ResponsiveContainer width="100%" height={180}>
		<BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
			<CartesianGrid
				strokeDasharray="3 3"
				stroke={GRID_COLOR}
				vertical={false}
			/>
			<XAxis
				dataKey="grade"
				tick={{ fill: AXIS_COLOR, fontSize: 10 }}
				axisLine={false}
				tickLine={false}
				interval={0}
				angle={-35}
				textAnchor="end"
				height={40}
			/>
			<YAxis
				tick={{ fill: AXIS_COLOR, fontSize: 10 }}
				axisLine={false}
				tickLine={false}
			/>
			<Tooltip
				contentStyle={tooltipStyle}
				cursor={{ fill: "rgba(255,255,255,0.04)" }}
				formatter={(v) => [v, "Burns/send"]}
			/>
			<Bar
				dataKey="burns_per_send"
				fill={COLOR_PROJECT}
				name="Burns/send"
				radius={[3, 3, 0, 0]}
			/>
		</BarChart>
	</ResponsiveContainer>
);

// ── View ──────────────────────────────────────────────────────────────────────

const StatsView = () => {
	const [discipline, setDiscipline] = useState<Discipline>("sport");
	const { data: stats, isLoading } = useClimbStats(discipline);

	return (
		<div className="flex flex-col gap-4">
			<h1 className="text-lg font-display font-semibold">Stats</h1>

			<ToggleGroup
				options={[
					{ value: "sport", label: "Sport" },
					{ value: "boulder", label: "Boulder" },
				]}
				value={discipline}
				onChange={(v) => setDiscipline(v as Discipline)}
			/>

			{isLoading && (
				<div className="flex justify-center pt-8">
					<Spinner />
				</div>
			)}

			{!isLoading && stats && (
				<>
					<ChartCard
						title="Grade distribution"
						empty={stats.gradeDistribution.length === 0}
					>
						<GradeDistributionChart data={stats.gradeDistribution} />
					</ChartCard>

					<ChartCard
						title="Sends per month"
						empty={stats.sendsPerMonth.length === 0}
					>
						<SendsPerMonthChart data={stats.sendsPerMonth} />
					</ChartCard>

					<ChartCard
						title="Burns per send"
						empty={stats.burnsPerSend.length === 0}
					>
						<BurnsPerSendChart data={stats.burnsPerSend} />
					</ChartCard>
				</>
			)}
		</div>
	);
};

export default StatsView;
