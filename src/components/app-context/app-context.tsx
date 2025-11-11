import { createContext, type Dispatch, type SetStateAction } from "react";
import type { ClimbType } from "../../types/climb";
import { UserType } from "@/types/user";

export type AppContextType = {
    appState: "home" | "add" | "profile";
    setAppState: Dispatch<SetStateAction<AppContextType["appState"]>>;
    userInfo: UserType | null;
    setUserInfo: Dispatch<SetStateAction<AppContextType["userInfo"]>>;
    currentClimb: ClimbType | null;
    setCurrentClimb: Dispatch<SetStateAction<AppContextType["currentClimb"]>>;
};

const AppContext = createContext<AppContextType>({} as AppContextType);

export default AppContext;
