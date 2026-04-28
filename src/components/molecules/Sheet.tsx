import { X } from "lucide-react";

interface SheetProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	/** Optional action rendered in the header right side (e.g. a confirm button). */
	action?: React.ReactNode;
	/** "primary" renders with accent-primary (teal) background and white text. */
	variant?: "primary";
}

/**
 * Full-screen overlay sheet. Stays within the current view — no navigation.
 * Use for pickers and flows that need more space but should return to context.
 */
export function Sheet({
	isOpen,
	onClose,
	title,
	children,
	action,
	variant,
}: SheetProps) {
	if (!isOpen) return null;

	const isPrimary = variant === "primary";

	return (
		<div
			className={`fixed inset-0 z-50 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ${isPrimary ? "bg-sheet-bg" : "bg-surface-page"}`}
		>
			{/* Header */}
			<div
				className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${isPrimary ? "border-white/20" : "border-border-default"}`}
			>
				<button
					type="button"
					onClick={onClose}
					className={`p-1 -ml-1 ${isPrimary ? "text-white/70" : "text-text-primary/70"}`}
					aria-label="Close"
				>
					<X size={20} />
				</button>
				<span
					className={`text-sm font-semibold ${isPrimary ? "text-white" : "text-text-primary"}`}
				>
					{title}
				</span>
				<div className="min-w-[28px] flex justify-end">{action ?? null}</div>
			</div>

			{/* Scrollable content */}
			<div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
		</div>
	);
}
