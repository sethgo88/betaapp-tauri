import { useContext } from "react";
import { AddContainer } from "../../views/add/add.container";
import HomeContainer from "../../views/home/home.container";
import NavContext from "./nav-context";

const NavRouter = () => {
	const { appState } = useContext(NavContext);
	switch (appState) {
		case "add":
			return <AddContainer />;
		default:
			return <HomeContainer />;
	}
};

export default NavRouter;
