interface TagPillProps {
	name: string;
	onRemove?: () => void;
}

export function TagPill({ name, onRemove }: TagPillProps) {
	return (
		<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-surface-raised text-text-secondary border border-border-default">
			{name}
			{onRemove && (
				<button
					type="button"
					onClick={onRemove}
					className="ml-1 text-text-tertiary hover:text-text-primary leading-none"
					aria-label={`Remove ${name}`}
				>
					×
				</button>
			)}
		</span>
	);
}
