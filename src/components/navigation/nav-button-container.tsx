import NavbarButton from "./nav-button";

const NavButtonContainer = () => {
    return (
        <div className="w-full flex bg-stone-900 absolute bottom-0 px-[3vw] py-[2vh] pb-[3vh]">
            <NavbarButton target="home">Home</NavbarButton>
            <NavbarButton target="add">Add</NavbarButton>
        </div>
    )
}

export default NavButtonContainer;