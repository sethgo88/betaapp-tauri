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

	const iconClass = (path: string) =>
		currentRoute === path ? "text-accent-primary" : "text-text-primary";

	return (
		<div className="w-full flex justify-around bg-surface-nav border-t border-border-default fixed bottom-0 px-[3vw] text-text-primary h-[7vh] items-center">
			<Button
				variant="unstyled"
				type="button"
				className="w-full text-center"
				onClick={() => navigate({ to: "/" })}
			>
				<Home className={`mx-auto ${iconClass("/")}`} size={22} />
			</Button>

			<Button
				variant="unstyled"
				type="button"
				className="w-full text-center"
				onClick={() => navigate({ to: "/climbs/add" })}
			>
				<PlusSquare
					className={`mx-auto ${iconClass("/climbs/add")}`}
					size={22}
				/>
			</Button>

			<Button
				variant="unstyled"
				type="button"
				className="w-full text-center"
				onClick={() => navigate({ to: "/search" })}
			>
				<Search className={`mx-auto ${iconClass("/search")}`} size={22} />
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
