import { cn } from "@/lib/cn";

interface ToggleGroupOption {
	value: string;
	label: string;
}

interface ToggleGroupProps {
	options: ToggleGroupOption[];
	value: string;
	onChange: (value: string) => void;
	/** "on-primary" renders for use on an accent-primary (teal) background. */
	variant?: "on-primary";
}

export const ToggleGroup = ({
	options,
	value,
	onChange,
	variant,
}: ToggleGroupProps) => {
	const onPrimary = variant === "on-primary";
	return (
		<div
			className={cn(
				"flex w-full rounded-[var(--radius-md)] p-1 gap-1",
				onPrimary
					? "bg-white/15 border border-white/20"
					: "bg-surface-card border border-border-default",
			)}
		>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					className={cn(
						"flex-1 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold transition-colors",
						value === option.value
							? onPrimary
								? "bg-white text-accent-primary"
								: "bg-accent-primary text-white"
							: onPrimary
								? "text-white"
								: "text-text-on-light",
					)}
					onClick={() => onChange(option.value)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
};
