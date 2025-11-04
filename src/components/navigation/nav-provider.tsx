import { type ReactNode, useState } from "react";
import NavContext, { type NavContextType } from "./nav-context";

type Props = { children: ReactNode };

export default function NavContextProvider({ children }: Props) {
	const [appState, setAppState] = useState<NavContextType["appState"]>("home");
	const [currentClimb, setCurrentClimb] =
		useState<NavContextType["currentClimb"]>(null);

	const context: NavContextType = {
		setAppState,
		appState,
		currentClimb,
		setCurrentClimb,
	};

	return <NavContext.Provider value={context}>{children}</NavContext.Provider>;
}
