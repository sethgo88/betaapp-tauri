import { cloneElement, isValidElement } from "react";
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
}: FormFieldProps) => {
	const errorId = htmlFor && error ? `${htmlFor}-error` : undefined;
	const field =
		errorId && isValidElement(children)
			? cloneElement(children as React.ReactElement<Record<string, unknown>>, {
					"aria-invalid": true,
					"aria-describedby": errorId,
				})
			: children;

	return (
		<div className={cn("flex flex-col gap-1", className)}>
			<label
				htmlFor={htmlFor}
				className="text-xs text-text-secondary uppercase tracking-wide"
			>
				{label}
			</label>
			{field}
			{error && (
				<span id={errorId} className="text-xs text-red-400">
					{error}
				</span>
			)}
		</div>
	);
};
