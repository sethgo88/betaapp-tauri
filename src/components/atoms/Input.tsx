import { cn } from "@/lib/cn";

type BaseInputAttributes = React.ComponentPropsWithoutRef<"input">;

interface InputProps extends BaseInputAttributes {
	className?: string;
	errorState?: boolean;
}

export const Input = (props: InputProps) => {
	const { className, errorState, ...rest } = props;
	return (
		<input
			className={cn(
				"rounded-[var(--radius-lg)] bg-surface-input p-2.5 font-medium outline-0 w-full border border-border-input text-text-primary focus:border-accent-primary transition-colors",
				errorState && "border-red-500 placeholder:text-red-400",
				className,
			)}
			{...rest}
		/>
	);
};
