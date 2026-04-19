import type { Climb } from "@/features/climbs/climbs.schema";
import { cn } from "@/lib/cn";

interface ClimbCardProps {
	climb: Climb;
	onClick: () => void;
}

export const ClimbCard = ({ climb, onClick }: ClimbCardProps) => {
	return (
		<li
			className={cn(
				"relative flex overflow-hidden bg-surface-stone text-text-on-light rounded-md p-2.5 shadow-card border border-card-border cursor-pointer gap-x-4",
			)}
		>
			<button
				type="button"
				className="flex flex-1 justify-between"
				onClick={onClick}
			>
				<div className="flex flex-col items-start flex-1">
					<span className="font-playfair text-[1.05rem] font-bold">
						{climb.name}
					</span>
					<span className="text-xs text-left max-w-4/5 text-current/70 italic">
						{[climb.area, climb.wall].filter(Boolean).join(" · ")}
					</span>
				</div>
				<div className="flex flex-col items-end justify-center">
					<span className="font-bold text-lg text-gray-800 font-playfair">
						{climb.grade}
					</span>
					<span
						className={cn(
							"text-[0.6rem] font-semibold uppercase tracking-wide",
							climb.sent_status === "sent" && "text-sent",
							climb.sent_status === "project" && "text-project",
							climb.sent_status === "todo" && "text-todo",
						)}
					>
						{climb.sent_status}
					</span>
				</div>
			</button>
		</li>
	);
};
