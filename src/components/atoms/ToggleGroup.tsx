import { cn } from "@/lib/cn";

interface ToggleGroupOption {
	value: string;
	label: string;
}

interface ToggleGroupProps {
	options: ToggleGroupOption[];
	value: string;
	onChange: (value: string) => void;
}

export const ToggleGroup = ({ options, value, onChange }: ToggleGroupProps) => {
	return (
		<div className="flex w-full rounded-[var(--radius-md)] bg-surface-card border border-border-default p-1 gap-1">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					className={cn(
						"flex-1 rounded-[var(--radius-md)] px-3 py-2 text-sm font-semibold transition-colors",
						value === option.value
							? "bg-accent-primary text-white"
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
