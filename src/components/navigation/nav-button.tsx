import AppContext, { AppContextType } from "@/components/app-context/app-context";
import { type ReactNode, useContext } from "react";

const NavbarButton = ({
	children,
	target,
}: {
	children: ReactNode;
	target: AppContextType["appState"];
}) => {
	const { setAppState } = useContext(AppContext);

	const handleOnClick = (target: AppContextType["appState"]) => () => {
		setAppState(target);
	};

	return (
		<button
			type="button"
			className="w-full text-center text-white"
			onClick={handleOnClick(target)}
		>
			{children}
		</button>
	);
};

export default NavbarButton;
