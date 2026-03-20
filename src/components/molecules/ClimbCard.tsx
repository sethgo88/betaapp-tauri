import type { Climb } from "@/features/climbs/climbs.schema";
import { cn } from "@/lib/cn";
import { buildLocationString } from "@/utils/build-location-string";

interface ClimbCardProps {
	climb: Climb;
	onClick: () => void;
}

export const ClimbCard = ({ climb, onClick }: ClimbCardProps) => {
	return (
		<li
			className={cn(
				"relative flex overflow-hidden bg-status-default rounded-md p-3.5 shadow-card border border-card-border cursor-pointer gap-x-4",
				climb.sent_status === "sent" && "bg-status-sent",
				climb.sent_status === "todo" && "bg-status-todo",
			)}
		>
			<button
				type="button"
				className="flex flex-col flex-1 justify-between"
				onClick={onClick}
			>
				<div className="flex flex-row items-start justify-between leading-none w-full">
					<span className="font-display font-bold">{climb.name}</span>
					<span className="font-display text-sm">{climb.grade}</span>
				</div>
				<div className="text-xs text-left max-w-4/5 text-current/70">
					{buildLocationString([
						climb.country,
						climb.area,
						climb.sub_area,
						climb.crag,
						climb.wall,
					])}
				</div>
			</button>
		</li>
	);
};
