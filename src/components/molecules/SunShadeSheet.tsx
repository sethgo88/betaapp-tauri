import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { CompassPicker } from "@/components/atoms/CompassPicker";
import { ToggleGroup } from "@/components/atoms/ToggleGroup";
import { Sheet } from "@/components/molecules/Sheet";
import { cn } from "@/lib/cn";
import type { Aspect, Month, SunData, SunExposure } from "@/lib/sun";

// ── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

const SEASONS = [
	{ name: "Winter", months: [12, 1, 2] as Month[] },
	{ name: "Spring", months: [3, 4, 5] as Month[] },
	{ name: "Summer", months: [6, 7, 8] as Month[] },
	{ name: "Fall", months: [9, 10, 11] as Month[] },
] as const;

// Cycle order: null → full-sun → partial-shade → full-shade → null
const EXPOSURE_CYCLE: (SunExposure | null)[] = [
	null,
	"full-sun",
	"partial-shade",
	"full-shade",
];

const EXPOSURE_LABELS: Record<SunExposure, string> = {
	"full-sun": "Sun",
	"full-shade": "Shade",
	"partial-shade": "Partial",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type MonthEntry = { am: SunExposure | null; pm: SunExposure | null };

// ── Helpers ──────────────────────────────────────────────────────────────────

function exposureClasses(exposure: SunExposure | null | undefined): string {
	switch (exposure) {
		case "full-sun":
			return "bg-accent-secondary text-text-on-dark";
		case "full-shade":
			return "bg-white/25 text-white";
		case "partial-shade":
			return "bg-white/15 text-white";
		default:
			return "bg-white/10 text-white/40";
	}
}

function exposureLabel(exposure: SunExposure | null | undefined): string {
	if (!exposure) return "—";
	return EXPOSURE_LABELS[exposure];
}

function dominantExposure(
	monthly: SunData["monthly"],
	months: readonly Month[],
): SunExposure | null {
	const entries = (monthly ?? []).filter((m) =>
		(months as Month[]).includes(m.month),
	);
	if (!entries.length) return null;
	const counts: Partial<Record<SunExposure, number>> = {};
	for (const { am, pm } of entries) {
		if (am) counts[am] = (counts[am] ?? 0) + 1;
		if (pm) counts[pm] = (counts[pm] ?? 0) + 1;
	}
	const sorted = (Object.entries(counts) as [SunExposure, number][]).sort(
		(a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
	);
	return sorted[0]?.[0] ?? null;
}

function buildMonthMap(monthly: SunData["monthly"]): Map<Month, MonthEntry> {
	const map = new Map<Month, MonthEntry>();
	for (let i = 1; i <= 12; i++) map.set(i as Month, { am: null, pm: null });
	for (const { month, am, pm } of monthly ?? []) {
		map.set(month, { am: am ?? null, pm: pm ?? null });
	}
	return map;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface SunShadeSheetProps {
	isOpen: boolean;
	data: SunData | null;
	isEditing: boolean;
	showAspect: boolean;
	onSave?: (data: SunData) => void;
	onClose: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SunShadeSheet({
	isOpen,
	data,
	isEditing,
	showAspect = true,
	onSave,
	onClose,
}: SunShadeSheetProps) {
	const [tab, setTab] = useState<"month" | "season">("month");

	const [editAspect, setEditAspect] = useState<Aspect | undefined>(
		data?.aspect,
	);
	const [editMonths, setEditMonths] = useState<Map<Month, MonthEntry>>(() =>
		buildMonthMap(data?.monthly),
	);
	// undefined = nothing selected yet; null = "clear"
	const [applyAllAm, setApplyAllAm] = useState<SunExposure | null>("full-sun");
	const [applyAllPm, setApplyAllPm] = useState<SunExposure | null>("full-sun");

	useEffect(() => {
		if (isOpen && isEditing) {
			setEditAspect(data?.aspect);
			setEditMonths(buildMonthMap(data?.monthly));
			setApplyAllAm("full-sun");
			setApplyAllPm("full-sun");
			setTab("month");
		}
	}, [isOpen, isEditing, data]);

	function cycleAm(month: Month) {
		setEditMonths((prev) => {
			const current = prev.get(month)!;
			const idx = EXPOSURE_CYCLE.indexOf(current.am);
			const map = new Map(prev);
			map.set(month, {
				...current,
				am: EXPOSURE_CYCLE[(idx + 1) % EXPOSURE_CYCLE.length],
			});
			return map;
		});
	}

	function cyclePm(month: Month) {
		setEditMonths((prev) => {
			const current = prev.get(month)!;
			const idx = EXPOSURE_CYCLE.indexOf(current.pm);
			const map = new Map(prev);
			map.set(month, {
				...current,
				pm: EXPOSURE_CYCLE[(idx + 1) % EXPOSURE_CYCLE.length],
			});
			return map;
		});
	}

	function handleApplyAll() {
		setEditMonths((prev) => {
			const map = new Map(prev);
			for (let i = 1; i <= 12; i++) {
				map.set(i as Month, { am: applyAllAm, pm: applyAllPm });
			}
			return map;
		});
	}

	function handleSave() {
		const monthly = Array.from(editMonths.entries())
			.filter(([, { am, pm }]) => am !== null || pm !== null)
			.map(([month, { am, pm }]) => ({
				month,
				...(am ? { am } : {}),
				...(pm ? { pm } : {}),
			}));

		if (!editAspect && !monthly.length) return;

		onSave?.({
			...(editAspect ? { aspect: editAspect } : {}),
			...(monthly.length ? { monthly } : {}),
		});
	}

	const title = isEditing ? "Edit Sun/Shade" : "Sun/Shade Exposure";

	const action = isEditing ? (
		<Button size="small" onClick={handleSave}>
			Save
		</Button>
	) : undefined;

	return (
		<Sheet
			isOpen={isOpen}
			onClose={onClose}
			title={title}
			action={action}
			variant="primary"
		>
			{isEditing ? (
				<EditContent
					showAspect={showAspect}
					editAspect={editAspect}
					setEditAspect={setEditAspect}
					editMonths={editMonths}
					cycleAm={cycleAm}
					cyclePm={cyclePm}
					applyAllAm={applyAllAm}
					setApplyAllAm={setApplyAllAm}
					applyAllPm={applyAllPm}
					setApplyAllPm={setApplyAllPm}
					handleApplyAll={handleApplyAll}
				/>
			) : (
				<ViewContent
					data={data}
					showAspect={showAspect}
					tab={tab}
					setTab={setTab}
				/>
			)}
		</Sheet>
	);
}

// ── View mode ────────────────────────────────────────────────────────────────

function ViewContent({
	data,
	showAspect,
	tab,
	setTab,
}: {
	data: SunData | null;
	showAspect: boolean;
	tab: "month" | "season";
	setTab: (t: "month" | "season") => void;
}) {
	if (!data) {
		return (
			<p className="text-white/60 text-sm text-center py-8">
				No exposure data recorded.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{showAspect && data.aspect && (
				<div className="flex items-center gap-2">
					<span className="text-sm text-white font-body">Aspect</span>
					<span className="bg-white text-accent-primary rounded px-2 py-0.5 text-sm font-semibold font-body">
						{data.aspect}
					</span>
				</div>
			)}

			<ToggleGroup
				options={[
					{ value: "month", label: "By Month" },
					{ value: "season", label: "By Season" },
				]}
				value={tab}
				onChange={(v) => {
					if (v === "month" || v === "season") setTab(v);
				}}
				variant="on-primary"
			/>

			{tab === "month" ? (
				<MonthTable monthly={data.monthly} />
			) : (
				<SeasonCards monthly={data.monthly} />
			)}
		</div>
	);
}

function MonthTable({ monthly }: { monthly: SunData["monthly"] }) {
	const map = buildMonthMap(monthly);

	return (
		<div className="rounded-card border border-white/20 overflow-hidden">
			{/* Header */}
			<div className="flex items-center px-4 py-1.5 border-b border-white/20">
				<span className="w-8" />
				<div className="flex ml-auto gap-1.5">
					<span className="text-xs text-white/50 font-body min-w-[52px] text-center">
						AM
					</span>
					<span className="text-xs text-white/50 font-body min-w-[52px] text-center">
						PM
					</span>
				</div>
			</div>

			{MONTH_NAMES.map((name, i) => {
				const month = (i + 1) as Month;
				const { am, pm } = map.get(month)!;
				return (
					<div
						key={month}
						className={cn(
							"flex items-center px-4 py-2 text-sm font-body gap-2",
							i !== 0 && "border-t border-white/20",
						)}
					>
						<span className="text-white w-8 shrink-0">{name}</span>
						<div className="flex ml-auto gap-1.5">
							<span
								className={cn(
									"rounded px-2 py-0.5 text-xs font-semibold min-w-[52px] text-center",
									exposureClasses(am),
								)}
							>
								{exposureLabel(am)}
							</span>
							<span
								className={cn(
									"rounded px-2 py-0.5 text-xs font-semibold min-w-[52px] text-center",
									exposureClasses(pm),
								)}
							>
								{exposureLabel(pm)}
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function SeasonCards({ monthly }: { monthly: SunData["monthly"] }) {
	return (
		<div className="grid grid-cols-2 gap-3">
			{SEASONS.map(({ name, months }) => {
				const dominant = dominantExposure(monthly, months);
				return (
					<div
						key={name}
						className="rounded-card border border-white/20 p-3 flex flex-col gap-1"
					>
						<span className="text-xs text-white/60 font-body">{name}</span>
						<span
							className={cn(
								"rounded px-2 py-0.5 text-sm font-semibold font-body self-start",
								exposureClasses(dominant),
							)}
						>
							{exposureLabel(dominant)}
						</span>
					</div>
				);
			})}
		</div>
	);
}

// ── Edit mode ────────────────────────────────────────────────────────────────

function ExposureRow({
	label,
	selected,
	onSelect,
}: {
	label: string;
	selected: SunExposure | null;
	onSelect: (e: SunExposure | null) => void;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-xs text-white/60 font-body">{label}</span>
			<div className="flex items-center gap-2 flex-wrap">
				{(
					[
						"full-sun",
						"partial-shade",
						"full-shade",
						null,
					] as (SunExposure | null)[]
				).map((e) => (
					<button
						key={String(e)}
						type="button"
						aria-pressed={selected === e}
						onClick={() => {
							if (selected !== e) onSelect(e);
						}}
						className={cn(
							"rounded px-3 py-1.5 text-xs font-semibold border transition-colors",
							selected === e
								? "border-white ring-1 ring-white"
								: "border-white/25",
							exposureClasses(e),
						)}
					>
						{e ? EXPOSURE_LABELS[e] : "Clear"}
					</button>
				))}
			</div>
		</div>
	);
}

function EditContent({
	showAspect,
	editAspect,
	setEditAspect,
	editMonths,
	cycleAm,
	cyclePm,
	applyAllAm,
	setApplyAllAm,
	applyAllPm,
	setApplyAllPm,
	handleApplyAll,
}: {
	showAspect: boolean;
	editAspect: Aspect | undefined;
	setEditAspect: (a: Aspect | undefined) => void;
	editMonths: Map<Month, MonthEntry>;
	cycleAm: (m: Month) => void;
	cyclePm: (m: Month) => void;
	applyAllAm: SunExposure | null;
	setApplyAllAm: (e: SunExposure | null) => void;
	applyAllPm: SunExposure | null;
	setApplyAllPm: (e: SunExposure | null) => void;
	handleApplyAll: () => void;
}) {
	return (
		<div className="flex flex-col gap-5">
			{showAspect && (
				<div className="flex flex-col gap-2">
					<span className="text-sm font-semibold text-white font-body">
						Aspect
					</span>
					<CompassPicker value={editAspect} onChange={setEditAspect} />
				</div>
			)}

			<div className="flex flex-col gap-1">
				<span className="text-sm font-semibold text-white font-body mb-1">
					Monthly exposure{" "}
					<span className="text-xs font-normal text-white/60">
						(tap to cycle)
					</span>
				</span>

				<div className="rounded-card border border-white/20 overflow-hidden">
					{/* Column headers */}
					<div className="flex items-center px-4 py-1.5 border-b border-white/20">
						<span className="w-8 shrink-0" />
						<div className="flex ml-auto gap-1.5">
							<span className="text-xs text-white/50 font-body min-w-[52px] text-center">
								AM
							</span>
							<span className="text-xs text-white/50 font-body min-w-[52px] text-center">
								PM
							</span>
						</div>
					</div>

					{MONTH_NAMES.map((name, i) => {
						const month = (i + 1) as Month;
						const { am, pm } = editMonths.get(month)!;
						return (
							<div
								key={month}
								className={cn(
									"flex items-center px-4 py-2 text-sm font-body gap-2",
									i !== 0 && "border-t border-white/20",
								)}
							>
								<span className="text-white w-8 shrink-0">{name}</span>
								<div className="flex ml-auto gap-1.5">
									<button
										type="button"
										aria-label={`${name} AM: ${exposureLabel(am)}, tap to cycle`}
										onClick={() => cycleAm(month)}
										className={cn(
											"rounded px-2 py-1 text-xs font-semibold transition-colors min-w-[52px] text-center",
											exposureClasses(am),
										)}
									>
										{exposureLabel(am)}
									</button>
									<button
										type="button"
										aria-label={`${name} PM: ${exposureLabel(pm)}, tap to cycle`}
										onClick={() => cyclePm(month)}
										className={cn(
											"rounded px-2 py-1 text-xs font-semibold transition-colors min-w-[52px] text-center",
											exposureClasses(pm),
										)}
									>
										{exposureLabel(pm)}
									</button>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			<div className="flex flex-col gap-3 pb-2">
				<span className="text-sm font-semibold text-white font-body">
					Apply to all months
				</span>
				<ExposureRow
					label="AM"
					selected={applyAllAm}
					onSelect={setApplyAllAm}
				/>
				<ExposureRow
					label="PM"
					selected={applyAllPm}
					onSelect={setApplyAllPm}
				/>
				<Button size="small" onClick={handleApplyAll} className="self-start">
					Apply
				</Button>
			</div>
		</div>
	);
}
