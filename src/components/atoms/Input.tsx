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
				"rounded-lg bg-stone-800 p-2 font-bold outline-0 w-full border border-stone-900",
				errorState && "border-red-500 placeholder:text-red-400",
				className,
			)}
			{...rest}
		/>
	);
};
