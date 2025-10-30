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
				"w-full flex justify-around bg-stone-900 fixed bottom-0 px-[3vw] py-[2vh] pb-[3vh] text-white",
				`${gridCols[children.length - 1]}`,
			)}
		>
			{children.map((child, i) => (
				<div className="grid grid-cols-1" key={child?.toString()}>
					{child}
				</div>
			))}
		</div>
	);
};

export default NavButtonContainer;
