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
		<div className="flex w-full rounded-md bg-stone-800 p-1 gap-1">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					className={cn(
						"flex-1 rounded-md px-3 py-2 text-sm font-bold transition-colors",
						value === option.value
							? "bg-stone-600 text-white"
							: "text-stone-400",
					)}
					onClick={() => onChange(option.value)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
};
