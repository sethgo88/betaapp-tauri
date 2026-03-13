import { useNavigate } from "@tanstack/react-router";
import { Home, Menu, PlusSquare, Search } from "lucide-react";
import { Button } from "@/components/atoms/Button";

interface NavBarProps {
	onMenuOpen: () => void;
}

export const NavBar = ({ onMenuOpen }: NavBarProps) => {
	const navigate = useNavigate();

	return (
		<div className="w-full flex justify-around bg-surface-nav fixed bottom-0 px-[3vw] text-text-primary h-[7vh] items-center">
			<Button
				variant="unstyled"
				type="button"
				className="w-full text-center"
				onClick={() => navigate({ to: "/" })}
			>
				<Home className="mx-auto" size={22} />
			</Button>

			<Button
				variant="unstyled"
				type="button"
				className="w-full text-center"
				onClick={() => navigate({ to: "/climbs/add" })}
			>
				<PlusSquare className="mx-auto" size={22} />
			</Button>

			<Button
				variant="unstyled"
				type="button"
				className="w-full text-center"
				onClick={() => navigate({ to: "/search" })}
			>
				<Search className="mx-auto" size={22} />
			</Button>

			<Button
				variant="unstyled"
				type="button"
				className="w-full text-center"
				onClick={onMenuOpen}
			>
				<Menu className="mx-auto" size={22} />
			</Button>
		</div>
	);
};
