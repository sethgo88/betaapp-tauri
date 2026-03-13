import { cn } from "@/lib/cn";

interface FormFieldProps {
	label: string;
	htmlFor?: string;
	error?: string;
	className?: string;
	children: React.ReactNode;
}

export const FormField = ({
	label,
	htmlFor,
	error,
	className,
	children,
}: FormFieldProps) => (
	<div className={cn("flex flex-col gap-1", className)}>
		<label
			htmlFor={htmlFor}
			className="text-xs text-text-secondary uppercase tracking-wide"
		>
			{label}
		</label>
		{children}
		{error && <span className="text-xs text-red-400">{error}</span>}
	</div>
);
