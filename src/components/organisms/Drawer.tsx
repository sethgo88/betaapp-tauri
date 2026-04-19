import { useNavigate } from "@tanstack/react-router";
import {
	BarChart2,
	CircleUser,
	Map as MapIcon,
	MapPin,
	Menu,
	PlusCircle,
	Settings,
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
			<div className="fixed top-0 right-0 bottom-0 w-64 bg-cyan-800/80 border-l border-white/20 z-[2001] flex flex-col pt-[env(safe-area-inset-top)] shadow-xl text-white">
				<div className="flex items-center justify-between p-4 border-b border-white/20">
					<div className="flex items-center gap-2">
						<Menu size={18} />
						<span className="font-semibold">Menu</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-white/70"
					>
						<X size={20} />
					</button>
				</div>

				<nav className="flex flex-col p-4 gap-1">
					<button
						type="button"
						className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-white/10"
						onClick={() => handleNav("/map")}
					>
						<MapIcon size={18} />
						<span>Map</span>
					</button>

					<button
						type="button"
						className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-white/10"
						onClick={() => handleNav("/routes")}
					>
						<MapPin size={18} />
						<span>Locations</span>
					</button>

					<button
						type="button"
						className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-white/10"
						onClick={() => handleNav("/routes/add")}
					>
						<PlusCircle size={18} />
						<span>Add Route</span>
					</button>

					{isAdmin && (
						<button
							type="button"
							className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-white/10"
							onClick={() => handleNav("/locations/add")}
						>
							<PlusCircle size={18} />
							<span>Add Location</span>
						</button>
					)}

					<button
						type="button"
						className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-white/10"
						onClick={() => handleNav("/stats")}
					>
						<BarChart2 size={18} />
						<span>Stats</span>
					</button>

					<button
						type="button"
						className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-white/10"
						onClick={() => handleNav("/profile")}
					>
						<CircleUser size={18} />
						<span>Profile</span>
					</button>

					<button
						type="button"
						className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-white/10"
						onClick={() => handleNav("/settings")}
					>
						<Settings size={18} />
						<span>Settings</span>
					</button>

					{isAdmin && (
						<>
							<div className="mt-4 mb-1 px-2">
								<p className="text-xs text-white/60 uppercase tracking-wide">
									Admin
								</p>
							</div>
							<button
								type="button"
								className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-white/10"
								onClick={() => handleNav("/admin/locations")}
							>
								<MapPin size={18} />
								<span>Location Manager</span>
							</button>
							<button
								type="button"
								className="flex items-center gap-3 py-3 px-2 text-left rounded-lg hover:bg-white/10"
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
