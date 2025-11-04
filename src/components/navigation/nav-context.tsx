import { createContext, type Dispatch, type SetStateAction } from "react";
import type { ClimbType } from "../../types/climb";

export type NavContextType = {
	appState: "home" | "add";
	setAppState: Dispatch<SetStateAction<NavContextType["appState"]>>;
	currentClimb: ClimbType | null;
	setCurrentClimb: Dispatch<SetStateAction<NavContextType["currentClimb"]>>;
};

const NavContext = createContext<NavContextType>({} as NavContextType);

export default NavContext;
