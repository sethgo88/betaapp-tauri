import { cn } from "@/lib/cn";

type BaseSelectAttributes = React.ComponentProps<"select">;

interface SelectProps extends BaseSelectAttributes {
	className?: string;
	selectClassName?: string;
	variant?: "default" | "text";
}

export const Select = (props: SelectProps) => {
	const { className, selectClassName, variant = "default", ...rest } = props;

	if (variant === "text") {
		return (
			<div className={cn("relative flex items-center w-full", className)}>
				<select
					className={cn(
						"appearance-none outline-0 w-full bg-transparent text-sm text-text-primary pr-5 cursor-pointer",
						selectClassName,
					)}
					{...rest}
				/>
				{/* Chevron */}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="absolute right-0 pointer-events-none text-text-on-light shrink-0"
					aria-hidden="true"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"rounded-[var(--radius-md)] bg-surface-input p-2.5 font-medium w-full text-text-on-light border border-border-input",
				className,
			)}
		>
			<select
				className={cn("outline-0 w-full bg-surface-input text-text-on-light", selectClassName)}
				{...rest}
			/>
		</div>
	);
};
