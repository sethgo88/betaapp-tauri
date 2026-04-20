import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { ToggleGroup } from "@/components/atoms/ToggleGroup";
import { Sheet } from "@/components/molecules/Sheet";
import { cn } from "@/lib/cn";
import type { Aspect, Month, SunData, SunExposure } from "@/lib/sun";

// ── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
	"Jan", "Feb", "Mar", "Apr", "May", "Jun",
	"Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const ASPECTS: Aspect[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

const SEASONS = [
	{ name: "Winter", months: [12, 1, 2] as Month[] },
	{ name: "Spring", months: [3, 4, 5] as Month[] },
	{ name: "Summer", months: [6, 7, 8] as Month[] },
	{ name: "Fall", months: [9, 10, 11] as Month[] },
] as const;

// Cycle order: null → full-sun → partial-shade → full-shade → null (light to dark)
const EXPOSURE_CYCLE: (SunExposure | null)[] = [
	null, "full-sun", "partial-shade", "full-shade",
];

const EXPOSURE_LABELS: Record<SunExposure, string> = {
	"full-sun": "Sun",
	"full-shade": "Shade",
	"partial-shade": "Partial",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function exposureClasses(exposure: SunExposure | null | undefined): string {
	switch (exposure) {
		case "full-sun":
			// amber accent — warm = sunny
			return "bg-accent-secondary text-text-on-dark";
		case "full-shade":
			// teal accent — cool = shade
			return "bg-accent-primary text-text-on-dark";
		case "partial-shade":
			return "bg-surface-stone text-text-secondary";
		default:
			return "bg-surface-stone text-text-tertiary";
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
	for (const { exposure } of entries) {
		counts[exposure] = (counts[exposure] ?? 0) + 1;
	}
	return (Object.entries(counts) as [SunExposure, number][]).sort(
		(a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
	)[0][0];
}

function buildMonthMap(monthly: SunData["monthly"]): Map<Month, SunExposure | null> {
	const map = new Map<Month, SunExposure | null>();
	for (let i = 1; i <= 12; i++) map.set(i as Month, null);
	for (const { month, exposure } of monthly ?? []) {
		map.set(month, exposure);
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
	showAspect,
	onSave,
	onClose,
}: SunShadeSheetProps) {
	const [tab, setTab] = useState<"month" | "season">("month");

	// Edit state — undefined means "nothing selected yet" for apply-all
	const [editAspect, setEditAspect] = useState<Aspect | undefined>(
		data?.aspect,
	);
	const [editMonths, setEditMonths] = useState<Map<Month, SunExposure | null>>(
		() => buildMonthMap(data?.monthly),
	);
	const [applyAll, setApplyAll] = useState<SunExposure | null | undefined>(
		undefined,
	);

	// Reset edit state when sheet opens or editing starts
	useEffect(() => {
		if (isOpen && isEditing) {
			setEditAspect(data?.aspect);
			setEditMonths(buildMonthMap(data?.monthly));
			setApplyAll(undefined);
			setTab("month");
		}
	}, [isOpen, isEditing, data]);

	function cycleExposure(month: Month) {
		setEditMonths((prev) => {
			const current = prev.get(month) ?? null;
			const idx = EXPOSURE_CYCLE.indexOf(current);
			const next = EXPOSURE_CYCLE[(idx + 1) % EXPOSURE_CYCLE.length];
			const map = new Map(prev);
			map.set(month, next);
			return map;
		});
	}

	function handleApplyAll() {
		if (applyAll === undefined) return;
		setEditMonths((prev) => {
			const map = new Map(prev);
			for (let i = 1; i <= 12; i++) map.set(i as Month, applyAll);
			return map;
		});
	}

	function handleSave() {
		const monthly = Array.from(editMonths.entries())
			.filter((entry): entry is [Month, SunExposure] => entry[1] !== null)
			.map(([month, exposure]) => ({ month, exposure }));

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
		<Sheet isOpen={isOpen} onClose={onClose} title={title} action={action}>
			{isEditing ? (
				<EditContent
					showAspect={showAspect}
					editAspect={editAspect}
					setEditAspect={setEditAspect}
					editMonths={editMonths}
					cycleExposure={cycleExposure}
					applyAll={applyAll}
					setApplyAll={setApplyAll}
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
			<p className="text-text-tertiary text-sm text-center py-8">
				No exposure data recorded.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{showAspect && data.aspect && (
				<div className="flex items-center gap-2">
					<span className="text-sm text-text-secondary font-body">Aspect</span>
					<span className="bg-accent-primary text-text-on-dark rounded px-2 py-0.5 text-sm font-semibold font-body">
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
		<div className="rounded-card border border-border-default overflow-hidden">
			{MONTH_NAMES.map((name, i) => {
				const month = (i + 1) as Month;
				const exposure = map.get(month) ?? null;
				return (
					<div
						key={month}
						className={cn(
							"flex items-center justify-between px-4 py-2.5 text-sm font-body",
							i !== 0 && "border-t border-border-default",
						)}
					>
						<span className="text-text-secondary w-8">{name}</span>
						<span
							className={cn(
								"rounded px-2 py-0.5 text-xs font-semibold",
								exposureClasses(exposure),
							)}
						>
							{exposureLabel(exposure)}
						</span>
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
						className="rounded-card border border-border-default p-3 flex flex-col gap-1"
					>
						<span className="text-xs text-text-tertiary font-body">{name}</span>
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

function EditContent({
	showAspect,
	editAspect,
	setEditAspect,
	editMonths,
	cycleExposure,
	applyAll,
	setApplyAll,
	handleApplyAll,
}: {
	showAspect: boolean;
	editAspect: Aspect | undefined;
	setEditAspect: (a: Aspect | undefined) => void;
	editMonths: Map<Month, SunExposure | null>;
	cycleExposure: (m: Month) => void;
	applyAll: SunExposure | null | undefined;
	setApplyAll: (e: SunExposure | null | undefined) => void;
	handleApplyAll: () => void;
}) {
	return (
		<div className="flex flex-col gap-5">
			{showAspect && (
				<div className="flex flex-col gap-2">
					<span className="text-sm font-semibold text-text-primary font-body">
						Aspect
					</span>
					<div className="grid grid-cols-4 gap-1.5">
						{ASPECTS.map((a) => (
							<button
								key={a}
								type="button"
								aria-pressed={editAspect === a}
								onClick={() => setEditAspect(editAspect === a ? undefined : a)}
								className={cn(
									"rounded py-2 text-sm font-semibold font-body transition-colors",
									editAspect === a
										? "bg-accent-primary text-text-on-dark"
										: "bg-surface-stone text-text-secondary",
								)}
							>
								{a}
							</button>
						))}
					</div>
				</div>
			)}

			<div className="flex flex-col gap-1">
				<span className="text-sm font-semibold text-text-primary font-body mb-1">
					Monthly exposure{" "}
					<span className="text-xs font-normal text-text-tertiary">
						(tap to cycle)
					</span>
				</span>

				<div className="rounded-card border border-border-default overflow-hidden">
					{MONTH_NAMES.map((name, i) => {
						const month = (i + 1) as Month;
						const exposure = editMonths.get(month) ?? null;
						return (
							<div
								key={month}
								className={cn(
									"flex items-center justify-between px-4 py-2 text-sm font-body",
									i !== 0 && "border-t border-border-default",
								)}
							>
								<span className="text-text-secondary w-8">{name}</span>
								<button
									type="button"
									aria-label={`${name} exposure: ${exposure ? EXPOSURE_LABELS[exposure] : "not set"}, tap to cycle`}
									onClick={() => cycleExposure(month)}
									className={cn(
										"rounded px-3 py-1 text-xs font-semibold transition-colors min-w-[72px] text-center",
										exposureClasses(exposure),
									)}
								>
									{exposureLabel(exposure)}
								</button>
							</div>
						);
					})}
				</div>
			</div>

			<div className="flex flex-col gap-2 pb-2">
				<span className="text-sm font-semibold text-text-primary font-body">
					Apply to all months
				</span>
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
							aria-pressed={applyAll === e}
							onClick={() => setApplyAll(applyAll === e ? undefined : e)}
							className={cn(
								"rounded px-3 py-1.5 text-xs font-semibold border transition-colors",
								applyAll === e
									? "border-accent-primary ring-1 ring-accent-primary"
									: "border-border-default",
								exposureClasses(e),
							)}
						>
							{e ? EXPOSURE_LABELS[e] : "Clear"}
						</button>
					))}
					<Button
						size="small"
						disabled={applyAll === undefined}
						onClick={handleApplyAll}
					>
						Apply
					</Button>
				</div>
			</div>
		</div>
	);
}
