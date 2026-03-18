import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Sheet } from "@/components/molecules/Sheet";
import { ToggleGroup } from "@/components/atoms/ToggleGroup";

interface ImportBetaSheetProps {
	isOpen: boolean;
	onClose: () => void;
	onImport: (moves: { id: string; text: string }[]) => void;
}

export const ImportBetaSheet = ({
	isOpen,
	onClose,
	onImport,
}: ImportBetaSheetProps) => {
	const [importText, setImportText] = useState("");
	const [importMode, setImportMode] = useState<"text" | "csv">("text");

	const handleClose = () => {
		setImportText("");
		setImportMode("text");
		onClose();
	};

	const handleImport = () => {
		if (!importText.trim()) return;
		const parsed =
			importMode === "csv"
				? importText.split(",").map((s) => s.trim()).filter(Boolean)
				: importText.split("\n").map((s) => s.trim()).filter(Boolean);
		onImport(parsed.map((text) => ({ id: crypto.randomUUID(), text })));
		handleClose();
	};

	return (
		<Sheet
			isOpen={isOpen}
			onClose={handleClose}
			title="Import Moves"
			action={
				<Button
					size="small"
					disabled={!importText.trim()}
					onClick={handleImport}
				>
					Import
				</Button>
			}
		>
			<div className="flex flex-col gap-4">
				<ToggleGroup
					options={[
						{ value: "text", label: "Plain text" },
						{ value: "csv", label: "CSV" },
					]}
					value={importMode}
					onChange={(v) => setImportMode(v as "text" | "csv")}
				/>
				<textarea
					className="w-full min-h-48 rounded-[var(--radius-md)] bg-surface-input p-3 text-sm outline-none resize-none"
					placeholder={
						importMode === "csv"
							? "move1, move2, move3..."
							: "Move 1\nMove 2\nMove 3..."
					}
					value={importText}
					onChange={(e) => {
						const text = e.target.value;
						setImportText(text);
						const hasCommas =
							text.split("\n").filter((line) => line.trimEnd().endsWith(","))
								.length > 1;
						setImportMode(hasCommas ? "csv" : "text");
					}}
				/>
				<p className="text-xs text-text-secondary">
					{importMode === "csv"
						? "Moves separated by commas."
						: "One move per line."}{" "}
					Importing will replace existing moves.
				</p>
			</div>
		</Sheet>
	);
};
