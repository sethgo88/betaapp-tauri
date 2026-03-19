import { useNavigate } from "@tanstack/react-router";
import {
	CircleUser,
	Map as MapIcon,
	MapPin,
	Menu,
	PlusCircle,
	X,
} from "lucide-react";
import { useAuthStore } from "@/features/auth/auth.store";

interface DrawerProps {
	isOpen: boolean;
	onClose: () => void;
}

export const Drawer = ({ isOpen, onClose }: DrawerProps) => {
	const navigate = useNavigate();
	const user = useAuthStore((s) => s.user);
	const isAdmin = user?.role === "admin";

	const handleNav = (to: string) => {
		onClose();
		navigate({ to });
	};

	if (!isOpen) return null;

	return (
		<>
			<button
				type="button"
				aria-label="Close menu"
				className="fixed inset-0 bg-black/60 z-[2000] w-full cursor-default"
				onClick={onClose}
			/>
			<div className="fixed top-0 right-0 bottom-0 w-64 bg-surface-nav border-l border-card-border z-[2001] flex flex-col pt-[env(safe-area-inset-top)]">
				<div className="flex items-center justify-between p-4 border-b border-border-default">
					<div className="flex items-center gap-2">
						<Menu size={18} />
						<span className="font-semibold">Menu</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-text-secondary"
					>
						<X size={20} />
					</button>
				</div>

				<nav className="flex flex-col p-4 gap-1">
					<button
						type="button"
						className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-surface-hover"
						onClick={() => handleNav("/map")}
					>
						<MapIcon size={18} />
						<span>Map</span>
					</button>

					<button
						type="button"
						className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-surface-hover"
						onClick={() => handleNav("/routes")}
					>
						<MapPin size={18} />
						<span>Route Manager</span>
					</button>

					<button
						type="button"
						className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-surface-hover"
						onClick={() => handleNav("/routes/add")}
					>
						<PlusCircle size={18} />
						<span>Add Route</span>
					</button>

					{isAdmin && (
						<button
							type="button"
							className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-surface-hover"
							onClick={() => handleNav("/locations/add")}
						>
							<PlusCircle size={18} />
							<span>Add Location</span>
						</button>
					)}

					<button
						type="button"
						className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-surface-hover"
						onClick={() => handleNav("/profile")}
					>
						<CircleUser size={18} />
						<span>Profile</span>
					</button>

					{isAdmin && (
						<>
							<div className="mt-4 mb-1 px-2">
								<p className="text-xs text-text-secondary uppercase tracking-wide">
									Admin
								</p>
							</div>
							<button
								type="button"
								className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-surface-hover"
								onClick={() => handleNav("/admin/locations")}
							>
								<MapPin size={18} />
								<span>Location Manager</span>
							</button>
							<button
								type="button"
								className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-surface-hover"
								onClick={() => handleNav("/admin/verify")}
							>
								<MapPin size={18} />
								<span>Verification</span>
							</button>
						</>
					)}
				</nav>
			</div>
		</>
	);
};
