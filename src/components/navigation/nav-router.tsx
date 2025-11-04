import { useContext, useEffect } from "react";
import { AddContainer } from "../../views/add/add.container";
import HomeContainer from "../../views/home/home.container";
import NavContext from "./nav-context";

const NavRouter = () => {
	const { appState, currentClimb, setCurrentClimb } = useContext(NavContext);
	useEffect(() => {
		if (appState !== "add" && currentClimb) {
			setCurrentClimb(null);
		}
	});
	switch (appState) {
		case "add":
			return (
				<AddContainer climbAsset={currentClimb ? currentClimb : undefined} />
			);
		default:
			return <HomeContainer />;
	}
};

export default NavRouter;
