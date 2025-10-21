import { useContext } from "react";
import NavContext from "./nav-context";
import { AddContainer } from "../../views/add/add.container";

const NavRouter = () => {
    const { appState } = useContext(NavContext);
    switch (appState) {
        case "add": 
            return <AddContainer />;
        default: 
            return <div> Home conotainer</div>

    }
}

export default NavRouter;