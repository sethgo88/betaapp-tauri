import { Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/Button";

interface EditableDescriptionProps {
	description: string | null | undefined;
	isAdmin: boolean;
	onSave: (description: string) => Promise<void>;
}

export const EditableDescription = ({
	description,
	isAdmin,
	onSave,
}: EditableDescriptionProps) => {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(description ?? "");
	const [saving, setSaving] = useState(false);

	const handleSave = async () => {
		setSaving(true);
		try {
			await onSave(draft);
			setEditing(false);
		} finally {
			setSaving(false);
		}
	};

	if (editing) {
		return (
			<div className="flex flex-col gap-2">
				<textarea
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					className="w-full text-sm bg-stone-700 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-500 outline-none min-h-[80px]"
					placeholder="Add a description…"
					// biome-ignore lint/a11y/noAutofocus: intentional — editing mode
					autoFocus
				/>
				<div className="flex gap-2">
					<Button
						type="button"
						variant="primary"
						size="small"
						onClick={handleSave}
						disabled={saving}
					>
						{saving ? "Saving…" : "Save"}
					</Button>
					<Button
						type="button"
						variant="secondary"
						size="small"
						onClick={() => {
							setDraft(description ?? "");
							setEditing(false);
						}}
					>
						Cancel
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-start gap-2">
			{description ? (
				<p className="text-sm text-stone-300 whitespace-pre-wrap">
					{description}
				</p>
			) : (
				<p className="text-sm text-stone-500 italic">No description</p>
			)}
			{isAdmin && (
				<button
					type="button"
					onClick={() => {
						setDraft(description ?? "");
						setEditing(true);
					}}
					className="text-stone-400 hover:text-stone-200 shrink-0 mt-0.5"
				>
					<Pencil size={14} />
				</button>
			)}
		</div>
	);
};
