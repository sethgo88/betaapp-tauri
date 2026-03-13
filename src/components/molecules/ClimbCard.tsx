import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { Climb } from "@/features/climbs/climbs.schema";
import { cn } from "@/lib/cn";
import { buildLocationString } from "@/utils/build-location-string";

interface ClimbCardProps {
	climb: Climb;
	onClick: () => void;
	onDelete?: (id: string) => Promise<void>;
}

export const ClimbCard = ({ climb, onClick, onDelete }: ClimbCardProps) => {
	const [showDelete, setShowDelete] = useState(false);

	return (
		<li
			className={cn(
				"relative flex overflow-hidden bg-status-default rounded-[--radius-xl] p-3.5 shadow-card border border-card-border cursor-pointer gap-x-4",
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
				<div className="text-xs text-current/70">
					{buildLocationString([climb.country, climb.area, climb.sub_area])}
				</div>
			</button>

			{onDelete && (
				<>
					<button
						type="button"
						className="p-2.5 text-text-secondary"
						onClick={() => setShowDelete(true)}
					>
						<Trash2 size={16} />
					</button>
					<div
						className={cn(
							"absolute grid h-full w-full cursor-pointer grid-cols-2 bg-surface-card text-center text-xl font-bold transition-all duration-200 top-0",
							showDelete ? "left-0" : "left-full",
						)}
					>
						<button
							type="button"
							className="bg-orange-700/40 text-amber-900 flex justify-center items-center"
							onClick={() => {
								onDelete(climb.id);
								setShowDelete(false);
							}}
						>
							<span>Delete</span>
						</button>
						<button
							type="button"
							className="bg-zinc-700/40 text-zinc-700 flex justify-center items-center"
							onClick={() => setShowDelete(false)}
						>
							<span>Cancel</span>
						</button>
					</div>
				</>
			)}
		</li>
	);
};
