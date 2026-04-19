import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { SiblingDropdown } from "@/components/molecules/SiblingDropdown";
import { Toast } from "@/components/molecules/Toast";
import { Drawer } from "@/components/organisms/Drawer";
import { NavBar } from "@/components/organisms/NavBar";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { useTopBar } from "@/hooks/useTopBar";
import { useUiStore } from "@/stores/ui.store";

interface AppLayoutProps {
	children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
	const toasts = useUiStore((s) => s.toasts);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const topBar = useTopBar();
	useAndroidBackButton();

	const hasSiblings = topBar.siblings.length > 1;

	return (
		<div className="relative min-h-screen min-w-screen max-w-screen text-text-primary pt-[env(safe-area-inset-top)]">
			{/* Blurred background image */}
			<div className="fixed w-full h-full bg-cyan-700/70 grayscale-50  inset-0 -z-9 scale -110"></div>
			<div
				className="fixed inset-0 -z-10 scale-110"
				style={{
					backgroundImage: "url('/bg-mountains.png')",
					backgroundSize: "cover",
					backgroundPosition: "center",
					filter: "blur(6px) brightness(1.5)",
				}}
			/>
			{/* Dark overlay for readability */}
			<div className="fixed inset-0 -z-10 bg-black/40" />
			<div className="relative">
				<div className="fixed top-[2vh] left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none items-center">
					{toasts.map((toast) => (
						<Toast key={toast.id} {...toast} />
					))}
				</div>
				<main className="pt-4 px-4 pb-[calc(7vh+1.5rem)]">
					{topBar.backLabel && (
						<div className="flex items-center justify-between mb-3 -ml-1">
							<button
								type="button"
								className="flex items-center gap-1 text-white text-sm shrink-0"
								onClick={topBar.goBack}
							>
								<ChevronLeft size={16} />
								{topBar.backLabel}
							</button>
							{hasSiblings && (
								<SiblingDropdown
									siblings={topBar.siblings}
									onSelect={topBar.goToSibling}
								/>
							)}
						</div>
					)}
					{children}
				</main>
			</div>
			<NavBar onMenuOpen={() => setDrawerOpen(true)} />
			<Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
		</div>
	);
};
