import { Cloud, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Month, SunData, SunExposure } from "@/lib/sun";

function ExposureIcon({ exposure }: { exposure: SunExposure }) {
	if (exposure === "full-sun") {
		return <Sun size={14} className="text-accent-secondary shrink-0" />;
	}
	if (exposure === "partial-shade") {
		return <Sun size={14} className="text-text-tertiary shrink-0" />;
	}
	return <Cloud size={14} className="text-text-tertiary shrink-0" />;
}

interface SunShadeSummaryProps {
	data: SunData | null;
	onClick: () => void;
}

export function SunShadeSummary({ data, onClick }: SunShadeSummaryProps) {
	const currentMonth = (new Date().getMonth() + 1) as Month;
	const currentEntry = data?.monthly?.find((m) => m.month === currentMonth);
	const effectiveAm = currentEntry?.am ?? null;
	const effectivePm = currentEntry?.pm ?? null;
	const showBoth = effectiveAm && effectivePm && effectiveAm !== effectivePm;

	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-body border border-border-default transition-colors",
				data
					? "bg-surface-card text-text-primary"
					: "bg-surface-stone text-text-tertiary",
			)}
		>
			{data ? (
				<>
					{data.aspect && (
						<span className="font-semibold bg-accent-primary text-text-on-dark rounded px-1 py-0.5 text-xs leading-none">
							{data.aspect}
						</span>
					)}
					{effectiveAm && (
						<>
							<ExposureIcon exposure={effectiveAm} />
							{showBoth && effectivePm && (
								<>
									<span className="text-text-tertiary text-xs leading-none">
										/
									</span>
									<ExposureIcon exposure={effectivePm} />
								</>
							)}
						</>
					)}
					{!effectiveAm && !effectivePm && (
						<Sun size={14} className="text-text-tertiary shrink-0" />
					)}
				</>
			) : (
				<Sun size={14} className="text-text-tertiary shrink-0" />
			)}
		</button>
	);
}
