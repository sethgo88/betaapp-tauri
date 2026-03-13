import { cn } from "@/lib/cn";

type BaseSelectAttributes = React.ComponentProps<"select">;

interface SelectProps extends BaseSelectAttributes {
	className?: string;
	selectClassName?: string;
}

export const Select = (props: SelectProps) => {
	const { className, selectClassName, ...rest } = props;
	return (
		<div
			className={cn(
				"rounded-md bg-surface-input p-2 font-bold w-full text-text-primary",
				className,
			)}
		>
			<select
				className={cn("outline-0 w-full bg-surface-input", selectClassName)}
				{...rest}
			/>
		</div>
	);
};
