import { useEffect, useRef, useState } from "react";
import { TagPill } from "@/components/atoms/TagPill";
import { useTags } from "@/features/tags/tags.queries";
import type { Tag } from "@/features/tags/tags.schema";

interface TagSelectProps {
	value: Tag[];
	onChange: (tags: Tag[]) => void;
}

export function TagSelect({ value, onChange }: TagSelectProps) {
	const { data: allTags = [] } = useTags();
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const touchStartY = useRef<number | null>(null);

	const selectedIds = new Set(value.map((t) => t.id));
	const filtered = allTags.filter((t) =>
		t.name.toLowerCase().includes(query.toLowerCase()),
	);

	useEffect(() => {
		function handleOutside(e: MouseEvent | TouchEvent) {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleOutside);
		document.addEventListener("touchstart", handleOutside);
		return () => {
			document.removeEventListener("mousedown", handleOutside);
			document.removeEventListener("touchstart", handleOutside);
		};
	}, []);

	function addTag(tag: Tag) {
		if (selectedIds.has(tag.id)) {
			onChange(value.filter((t) => t.id !== tag.id));
		} else {
			onChange([...value, tag]);
		}
		setQuery("");
	}

	function removeTag(id: string) {
		onChange(value.filter((t) => t.id !== id));
	}

	return (
		<div ref={containerRef} className="flex flex-col gap-2">
			{value.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{value.map((tag) => (
						<TagPill
							key={tag.id}
							name={tag.name}
							onRemove={() => removeTag(tag.id)}
						/>
					))}
				</div>
			)}
			<div className="relative">
				<input
					type="text"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					placeholder="Search tags…"
					className="w-full text-sm rounded-[var(--radius-sm)] px-3 py-1.5 bg-surface-input border border-border-input text-text-on-light placeholder:text-text-on-light/50 outline-none"
				/>
				{open && filtered.length > 0 && (
					<ul className="absolute z-10 mt-1 w-full rounded-[var(--radius-sm)] border border-border-default bg-surface-card max-h-48 overflow-y-auto">
						{filtered.map((tag) => {
							const isSelected = selectedIds.has(tag.id);
							return (
								<li key={tag.id}>
									<button
										type="button"
										onMouseDown={(e) => {
											e.preventDefault();
											addTag(tag);
										}}
										onTouchStart={(e) => {
											touchStartY.current = e.touches[0]?.clientY ?? null;
										}}
										onTouchEnd={(e) => {
											const startY = touchStartY.current;
											touchStartY.current = null;
											if (
												startY !== null &&
												Math.abs(e.changedTouches[0].clientY - startY) > 8
											)
												return;
											e.preventDefault();
											addTag(tag);
										}}
										className={`w-full text-left px-3 py-1.5 text-sm ${isSelected ? "bg-surface-raised text-accent-primary font-medium" : "text-text-primary hover:bg-surface-hover"}`}
									>
										{tag.name}
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
