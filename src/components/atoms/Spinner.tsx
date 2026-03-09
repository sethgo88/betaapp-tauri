import { cn } from "@/lib/cn";

interface SpinnerProps {
	className?: string;
	size?: "sm" | "md" | "lg";
}

const sizeClasses = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" };

export const Spinner = ({ className, size = "md" }: SpinnerProps) => (
	<div
		className={cn(
			"animate-spin rounded-full border-2 border-stone-600 border-t-emerald-500",
			sizeClasses[size],
			className,
		)}
	/>
);
