import { type ReactNode, useState } from "react";
import AppContext, { type AppContextType } from "./app-context";
import { UserType } from "@/types/user";

type Props = { children: ReactNode };

export default function AppContextProvider({ children }: Props) {
	const [appState, setAppState] = useState<AppContextType["appState"]>("home");
    const [userInfo, setUserInfo] = useState<UserType | null>(null)
	const [currentClimb, setCurrentClimb] =
		useState<AppContextType["currentClimb"]>(null);

	const context: AppContextType = {
		appState,
		setAppState,
        userInfo,
        setUserInfo,
		currentClimb,
		setCurrentClimb,
	};

	return <AppContext.Provider value={context}>{children}</AppContext.Provider>;
}
