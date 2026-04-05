import { useEffect, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { RouteLinkSubmitSchema } from "@/features/routes/routes.schema";

interface AddLinkModalProps {
	isOpen: boolean;
	isPending: boolean;
	onSave: (url: string, title: string | undefined) => void;
	onCancel: () => void;
}

export function AddLinkModal({
	isOpen,
	isPending,
	onSave,
	onCancel,
}: AddLinkModalProps) {
	const [url, setUrl] = useState("");
	const [title, setTitle] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isOpen) {
			setUrl("");
			setTitle("");
			setError(null);
		}
	}, [isOpen]);

	if (!isOpen) return null;

	function handleSave() {
		const result = RouteLinkSubmitSchema.safeParse({
			url,
			title: title.trim() || undefined,
		});
		if (!result.success) {
			setError(result.error.issues[0]?.message ?? "Invalid input");
			return;
		}
		setError(null);
		onSave(result.data.url, result.data.title);
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
			<div className="w-full max-w-sm rounded-xl bg-surface-raised p-5 flex flex-col gap-4 shadow-card">
				<p className="font-semibold text-text-primary">Add link</p>
				<div className="flex flex-col gap-2">
					<Input
						type="url"
						placeholder="https://..."
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						errorState={!!error}
					/>
					<Input
						type="text"
						placeholder="Title (optional)"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
					/>
					{error && <p className="text-xs text-red-400">{error}</p>}
				</div>
				<div className="flex gap-2">
					<Button variant="outlined" className="flex-1" onClick={onCancel}>
						Cancel
					</Button>
					<Button
						variant="primary"
						className="flex-1"
						onClick={handleSave}
						disabled={isPending || !url.trim()}
					>
						{isPending ? "Saving…" : "Save"}
					</Button>
				</div>
			</div>
		</div>
	);
}
