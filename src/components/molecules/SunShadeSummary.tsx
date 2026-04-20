import { Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { summarizeSunData } from "@/lib/sun";
import type { SunData } from "@/lib/sun";

interface SunShadeSummaryProps {
	data: SunData | null;
	onClick: () => void;
}

export function SunShadeSummary({ data, onClick }: SunShadeSummaryProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-body border border-border-default transition-colors",
				data
					? "bg-surface-card text-text-primary"
					: "bg-surface-stone text-text-tertiary",
			)}
		>
			<Sun
				size={14}
				className={
					data ? "text-accent-secondary shrink-0" : "text-text-tertiary shrink-0"
				}
			/>
			{data ? (
				<span className="flex items-center gap-1.5">
					{data.aspect && (
						<span className="font-semibold bg-accent-primary text-text-on-dark rounded px-1 py-0.5 text-xs leading-none">
							{data.aspect}
						</span>
					)}
					<span>{summarizeSunData(data)}</span>
				</span>
			) : (
				<span>No exposure data</span>
			)}
		</button>
	);
}
