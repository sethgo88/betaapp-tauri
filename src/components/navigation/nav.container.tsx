import { useContext } from "react";
import { IoHomeOutline, IoSaveOutline } from "react-icons/io5";
import { MdOutlinePlaylistAdd } from "react-icons/md";
import { Button } from "../button/button";
import NavbarButton from "./nav-button";
import NavButtonContainer from "./nav-button-container";
import NavContext from "./nav-context";
import NavRouter from "./nav-router";

const NavContainer = () => {
	const { appState } = useContext(NavContext);

	switch (appState) {
		case "add":
			return (
				<>
					<NavRouter />
					<NavButtonContainer>
						<NavbarButton target="home">
							<IoHomeOutline className="text-2xl" />
						</NavbarButton>
						<NavbarButton target="add">
							<MdOutlinePlaylistAdd className="text-2xl" />
						</NavbarButton>
						<Button variant="unstyled" type="submit" form="climb-form">
							<IoSaveOutline className="text-2xl" />
						</Button>
					</NavButtonContainer>
				</>
			);
		case "home":
			return (
				<>
					<NavRouter />
					<NavButtonContainer>
						<NavbarButton target="home">
							<IoHomeOutline className="text-2xl" />
						</NavbarButton>
						<NavbarButton target="add">
							<MdOutlinePlaylistAdd className="text-2xl" />
						</NavbarButton>
					</NavButtonContainer>
				</>
			);
		default:
			return null;
	}
};

export default NavContainer;
