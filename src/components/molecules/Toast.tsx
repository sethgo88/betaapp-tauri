import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { type Toast as ToastType, useUiStore } from "@/stores/ui.store";

const borderColor: Record<ToastType["type"], string> = {
	success: "border-l-emerald-500",
	error: "border-l-red-500",
	warning: "border-l-amber-500",
};

export const Toast = ({ id, message, type }: ToastType) => {
	const removeToast = useUiStore((s) => s.removeToast);

	useEffect(() => {
		const timer = setTimeout(() => removeToast(id), 2000);
		return () => clearTimeout(timer);
	}, [id, removeToast]);

	return (
		<div
			className={cn(
				"bg-surface-card text-text-primary border-l-4 drop-shadow-lg rounded-2xl absolute top-[2vh] left-[calc(50vw)] -translate-x-1/2 p-2.5 whitespace-nowrap",
				borderColor[type],
			)}
		>
			{message}
		</div>
	);
};
