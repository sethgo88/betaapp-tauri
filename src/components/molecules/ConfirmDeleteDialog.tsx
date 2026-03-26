import { Button } from "@/components/atoms/Button";

interface ConfirmDeleteDialogProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export function ConfirmDeleteDialog({
	isOpen,
	title,
	message,
	confirmLabel = "Delete",
	cancelLabel = "Cancel",
	onConfirm,
	onCancel,
}: ConfirmDeleteDialogProps) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
			<div className="w-full max-w-sm rounded-xl bg-surface-raised p-5 flex flex-col gap-4 shadow-card">
				<div>
					<p className="font-semibold text-text-primary">{title}</p>
					<p className="text-sm text-text-secondary mt-1">{message}</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outlined" className="flex-1" onClick={onCancel}>
						{cancelLabel}
					</Button>
					<Button variant="primary" className="flex-1" onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
}
