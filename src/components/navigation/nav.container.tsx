import { invoke } from "@tauri-apps/api/core";
import { useContext } from "react";
import { GoTrash } from "react-icons/go";
import { IoHomeOutline, IoSaveOutline } from "react-icons/io5";
import { MdOutlinePlaylistAdd } from "react-icons/md";
import { Button } from "../button/button";
import NavbarButton from "./nav-button";
import NavButtonContainer from "./nav-button-container";
import NavRouter from "./nav-router";
import AppContext from "@/components/app-context/app-context";
import { FaRegCircleUser } from "react-icons/fa6";

const NavContainer = () => {
	const { appState, currentClimb, setAppState, setCurrentClimb } =
		useContext(AppContext);

	const deleteClimb = async () => {
		if (!currentClimb) return;
		const response = await invoke("delete_climb", { id: currentClimb.id });
		if (response) {
			alert("Failed to delete climb - no response from backend");
			return;
		}
		setAppState("home");
		setCurrentClimb(null);
	};
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
						<Button onClick={deleteClimb} variant="unstyled" type="button">
							<GoTrash className="text-2xl" />
						</Button>
						<NavbarButton target="profile">
							<FaRegCircleUser className="text-2xl" />
						</NavbarButton>
					</NavButtonContainer>
				</>
			);
		case "home":
		case "profile":
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
						<NavbarButton target="profile">
							<FaRegCircleUser className="text-2xl" />
						</NavbarButton>
					</NavButtonContainer>
				</>
			);
		default:
			return null;
	}
};

export default NavContainer;
