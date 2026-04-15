import { cn } from "@/lib/cn";

interface StarRatingProps {
	value: number | null | undefined;
	onChange?: (value: number | null) => void;
	readOnly?: boolean;
	size?: number;
}

const StarIcon = ({
	filled,
	size,
}: {
	filled: boolean;
	size: number;
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill={filled ? "currentColor" : "none"}
		stroke="currentColor"
		strokeWidth={1.5}
		strokeLinecap="round"
		strokeLinejoin="round"
		className={cn(filled ? "text-accent-secondary" : "text-border-default")}
	>
		<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
	</svg>
);

export const StarRating = ({
	value,
	onChange,
	readOnly = false,
	size = 20,
}: StarRatingProps) => {
	const filled = (star: number) => value != null && star <= value;

	if (readOnly) {
		return (
			<div
				role="img"
				aria-label={`${value ?? 0} out of 5 stars`}
				className="flex items-center gap-0.5"
			>
				{[1, 2, 3, 4, 5].map((star) => (
					<span key={star} aria-hidden="true">
						<StarIcon filled={filled(star)} size={size} />
					</span>
				))}
			</div>
		);
	}

	return (
		<div className="flex items-center gap-0.5">
			{[1, 2, 3, 4, 5].map((star) => (
				<button
					key={star}
					type="button"
					aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
					aria-pressed={value === star}
					onClick={() => onChange?.(value === star ? null : star)}
					className="cursor-pointer transition-colors"
				>
					<StarIcon filled={filled(star)} size={size} />
				</button>
			))}
		</div>
	);
};
