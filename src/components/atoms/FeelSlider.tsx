import { cn } from "@/lib/cn";

const FEEL_LABELS: Record<number, string> = {
	0: "0",
	1: "1",
	2: "2",
	3: "3",
	4: "4",
	5: "5",
};

interface FeelSliderProps {
	value: number | null | undefined;
	onChange: (value: number | null) => void;
}

export const FeelSlider = ({ value, onChange }: FeelSliderProps) => {
	return (
		<div className="w-full px-1 pt-6 pb-2">
			<div className="relative flex items-center justify-between">
				{/* connecting line */}
				<div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border-default" />

				{[0, 1, 2, 3, 4, 5].map((step) => {
					const selected = value === step;
					return (
						<div key={step} className="relative flex flex-col items-center">
							{/* label above selected */}
							<span
								className={cn(
									"absolute bottom-full mb-2 text-xs whitespace-nowrap",
									selected && "text-accent-primary",
								)}
							>
								{FEEL_LABELS[step]}
							</span>

							<button
								type="button"
								aria-label={FEEL_LABELS[step]}
								onClick={() => onChange(selected ? null : step)}
								className={cn(
									"relative z-10 w-6 h-6 rounded-full border-2 transition-colors",
									selected
										? "bg-accent-primary border-accent-primary"
										: "bg-surface-card border-border-default",
								)}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
};
