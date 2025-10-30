import { createContext, type Dispatch, type SetStateAction } from "react";

export type NavContextType = {
	appState: "home" | "add";
	setAppState: Dispatch<SetStateAction<NavContextType["appState"]>>;
};

const NavContext = createContext<NavContextType>({} as NavContextType);

export default NavContext;
