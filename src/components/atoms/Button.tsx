import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "outlined" | "unstyled";
type ButtonSize = "small" | "medium" | "large";

type BaseButtonAttributes = React.ComponentPropsWithoutRef<"button">;

interface ButtonProps extends BaseButtonAttributes {
	className?: string;
	variant?: ButtonVariant;
	size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
	primary: "bg-accent-primary text-white hover:bg-accent-primary/90",
	secondary: "bg-accent-secondary text-white hover:bg-accent-secondary/90",
	outlined:
		"border-2 border-accent-primary text-accent-primary hover:bg-accent-primary/10",
	unstyled: "text-text-primary",
};

const sizeClasses: Record<ButtonSize, string> = {
	small: "px-3 py-1 text-sm",
	medium: "px-4 py-2 text-base",
	large: "px-6 py-3 text-lg",
};

export const Button = (props: ButtonProps) => {
	const { className, type, variant = "primary", size, ...rest } = props;
	return (
		<button
			className={cn(
				"cursor-pointer rounded-[--radius-md] font-semibold transition-colors",
				variantClasses[variant],
				size && sizeClasses[size],
				className,
			)}
			type={type}
			{...rest}
		/>
	);
};
