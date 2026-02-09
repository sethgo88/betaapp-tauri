import { useContext, useEffect } from "react";
import { AddContainer } from "../../views/add/add.container";
import HomeContainer from "../../views/home/home.container";
import AppContext from "@/components/app-context/app-context";
import ProfileContainer from "@/views/profile/profile.container";

const NavRouter = () => {
	const { appState, setAppState, currentClimb, setCurrentClimb, userInfo } = useContext(AppContext);
	useEffect(() => {
		if (appState !== "add" && currentClimb) {
			setCurrentClimb(null);
		}
	}, []);

	useEffect(() => {
		if(!userInfo){
			setAppState("profile")
		}
	}, [appState])
	switch (appState) {
		case "add":
			return <AddContainer climbAsset={currentClimb ? currentClimb : undefined} />
		case "home":
			return <HomeContainer />;
		case "profile":
			return <ProfileContainer />;
	}
};

export default NavRouter;
