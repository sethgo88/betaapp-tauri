import { useNavigate } from "@tanstack/react-router";
import { Home, Menu, PlusSquare, Search } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useCurrentRoute } from "@/hooks/useCurrentRoute";

interface NavBarProps {
	onMenuOpen: () => void;
}

export const NavBar = ({ onMenuOpen }: NavBarProps) => {
	const navigate = useNavigate();
	const currentRoute = useCurrentRoute();

	const iconWrap = (path: string) =>
		currentRoute === path
			? "inline-flex items-center justify-center bg-accent-secondary/75 rounded p-1.5"
			: "inline-flex items-center justify-center";

	return (
		<div className="w-full flex justify-around bg-cyan-800/80 shadow-xl fixed bottom-0 px-[3vw] text-white h-[7vh] items-center [box-shadow:0_-4px_12px_rgba(0,0,0,0.1)]">
			<Button
				variant="unstyled"
				type="button"
				className="w-full flex items-center justify-center"
				onClick={() => navigate({ to: "/" })}
			>
				<span className={iconWrap("/")}>
					<Home className="text-white" size={22} />
				</span>
			</Button>

			<Button
				variant="unstyled"
				type="button"
				className="w-full flex items-center justify-center"
				onClick={() => navigate({ to: "/climbs/add" })}
			>
				<span className={iconWrap("/climbs/add")}>
					<PlusSquare className="text-white" size={22} />
				</span>
			</Button>

			<Button
				variant="unstyled"
				type="button"
				className="w-full flex items-center justify-center"
				onClick={() => navigate({ to: "/search" })}
			>
				<span className={iconWrap("/search")}>
					<Search className="text-white" size={22} />
				</span>
			</Button>

			<Button
				variant="unstyled"
				type="button"
				className="w-full flex items-center justify-center"
				onClick={onMenuOpen}
			>
				<span className="inline-flex items-center justify-center">
					<Menu className="text-white" size={22} />
				</span>
			</Button>
		</div>
	);
};
