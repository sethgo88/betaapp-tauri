import { X } from "lucide-react";

interface SheetProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
	/** Optional action rendered in the header right side (e.g. a confirm button). */
	action?: React.ReactNode;
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
}: SheetProps) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-surface-page pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 border-b border-border-default shrink-0">
				<button
					type="button"
					onClick={onClose}
					className="text-text-secondary p-1 -ml-1"
					aria-label="Close"
				>
					<X size={20} />
				</button>
				<span className="text-sm font-semibold text-text-primary">{title}</span>
				<div className="min-w-[28px] flex justify-end">{action ?? null}</div>
			</div>

			{/* Scrollable content */}
			<div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
		</div>
	);
}
