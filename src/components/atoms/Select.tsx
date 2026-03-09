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
			className={cn("rounded-md bg-stone-800 p-2 font-bold w-full", className)}
		>
			<select
				className={cn("outline-0 w-full bg-stone-800", selectClassName)}
				{...rest}
			/>
		</div>
	);
};
