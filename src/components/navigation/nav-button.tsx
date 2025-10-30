import { type ReactNode, useContext } from "react";
import NavContext, { type NavContextType } from "./nav-context";

const NavbarButton = ({
	children,
	target,
}: {
	children: ReactNode;
	target: NavContextType["appState"];
}) => {
	const { setAppState } = useContext(NavContext);

	const handleOnClick = (target: NavContextType["appState"]) => () => {
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
