import { ReactNode, useContext } from "react";
import NavContext, { NavContextType } from "./nav-context";

const NavbarButton = ({children, target}: {children: ReactNode, target: NavContextType['appState']}) => {
    const { setAppState } = useContext(NavContext);

    const handleOnClick = (target: NavContextType['appState']) => () => {
        setAppState(target);
    }

    return (
        <div className="w-full text-center" onClick={handleOnClick(target)}>
            {children}
        </div>
    )
}

export default NavbarButton;