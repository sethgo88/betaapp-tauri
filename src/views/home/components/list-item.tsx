import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { DeleteButton } from "@/components/delete-button/delete-button";

export type ListItemProps = Omit<React.ComponentPropsWithoutRef<"li">, "id"> & {
	onDelete?: (id: string) => Promise<void>;
	id: string;
	className?: string;
};

export const ListItem = (props: ListItemProps) => {
	const { children, onDelete, id, className, ...rest } = props;
	const [showDelete, setShowDelete] = useState(false);

	return (
		<li
			className={twMerge(
				"relative flex overflow-hidden bg-stone-950/20 rounded-xl p-2.5 shadow-sm hover:shadow-none cursor-pointer gap-x-4",
				className,
			)}
			{...rest}
		>
			{children}
			{onDelete && (
				<>
					<DeleteButton className="p-2.5" onClick={() => setShowDelete(true)} />
					<div
						className={twMerge(
							"absolute grid h-full w-full cursor-pointer grid-cols-2 bg-white text-center text-xl font-bold transition-all duration-200 top-0",
							showDelete ? "left-0" : "left-full",
						)}
					>
						<button
							type="button"
							className="bg-orange-700/40 text-amber-900 flex justify-center items-center"
							onClick={() => {
								onDelete(id);
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
