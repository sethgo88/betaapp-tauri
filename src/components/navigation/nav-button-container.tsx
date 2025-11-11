import type { ReactNode } from "react";
import { twMerge } from "tailwind-merge";

const NavButtonContainer = ({ children }: { children: ReactNode[] }) => {
	const gridCols = [
		"grid-cols-1",
		"grid-cols-2",
		"grid-cols-3",
		"grid-cols-4",
		"grid-cols-5",
	];
	return (
		<div
			className={twMerge(
				"w-full flex justify-around bg-stone-900 fixed bottom-0 px-[3vw] text-white h-[7vh]",
				`${gridCols[children.length - 1]}`,
			)}
		>
			{children.map((child) => (
				<div className="grid grid-cols-1" key={`${Math.random()}`}>
					{child}
				</div>
			))}
		</div>
	);
};

export default NavButtonContainer;
