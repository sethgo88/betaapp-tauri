import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { type Toast as ToastType, useUiStore } from "@/stores/ui.store";

const typeStyles: Record<ToastType["type"], string> = {
	success: "text-emerald-900",
	error: "text-red-900",
	warning: "text-yellow-900",
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
				"bg-amber-50 drop-shadow-lg rounded-2xl absolute top-[2vh] left-[calc(50vw)] -translate-x-1/2 p-2.5 whitespace-nowrap",
				typeStyles[type],
			)}
		>
			{message}
		</div>
	);
};
