import { twMerge } from "tailwind-merge";

type ButtonVariant = "primary" | "secondary" | "outlined" | "unstyled";
type ButtonSize = "small" | "medium" | "large";

type BaseButtonAttributes = React.ComponentPropsWithoutRef<"button">;

interface ButtonProps extends BaseButtonAttributes {
	className?: string;
	variant?: ButtonVariant;
	size?: ButtonSize;
}

const getVariantClasses = (variant: ButtonVariant = "primary") => {
	const variants = {
		primary: "bg-emerald-600 text-white hover:bg-emerald-700",
		secondary: "bg-zinc-600 text-white hover:bg-zinc-700",
		outlined:
			"border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50",
		unstyled: "text-white",
	};
	return variants[variant];
};

const getSizeClasses = (size: ButtonSize = "medium") => {
	const sizes = {
		small: "px-3 py-1 text-sm",
		medium: "px-4 py-2 text-base",
		large: "px-6 py-3 text-lg",
	};
	return sizes[size];
};

export const Button = (props: ButtonProps) => {
	const { className, type, variant = "primary", size, ...rest } = props;
	return (
		<button
			className={twMerge(
				"cursor-pointer rounded-md font-medium transition-colors",
				getVariantClasses(variant),
				size && getSizeClasses(size),
				className,
			)}
			type={type}
			{...rest}
		/>
	);
};
