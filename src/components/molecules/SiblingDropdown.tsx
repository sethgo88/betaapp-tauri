import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Sibling } from "@/hooks/useTopBar";

type SiblingDropdownProps = {
	siblings: Sibling[];
	onSelect: (id: string) => void;
};

export function SiblingDropdown({ siblings, onSelect }: SiblingDropdownProps) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	const current = siblings.find((s) => s.isCurrent);

	// Close on outside tap
	useEffect(() => {
		if (!open) return;
		const handler = (e: PointerEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", handler);
		return () => document.removeEventListener("pointerdown", handler);
	}, [open]);

	if (siblings.length <= 1) return null;

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				className="flex items-center gap-1 text-text-on-dark text-sm font-medium"
				onClick={() => setOpen(!open)}
			>
				{current?.label ?? "Select"}
				<ChevronDown
					size={14}
					className={`transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			{open && (
				<div className="absolute top-full right-0 mt-2 min-w-[200px] max-h-[calc(100dvh-7vh-4rem)] overflow-y-auto bg-surface-card border border-card-border rounded-[var(--radius-lg)] shadow-elevated z-50">
					{siblings.map((s) => (
						<button
							key={s.id}
							type="button"
							className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-3 ${
								s.isCurrent
									? "text-accent-primary font-medium"
									: "text-text-primary"
							}`}
							onClick={() => {
								if (!s.isCurrent) onSelect(s.id);
								setOpen(false);
							}}
						>
							<span className="truncate">{s.label}</span>
							{s.sublabel && (
								<span className="text-text-on-light text-xs shrink-0">
									{s.sublabel}
								</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
