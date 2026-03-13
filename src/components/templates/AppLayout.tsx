import type { ReactNode } from "react";
import { useState } from "react";
import { Toast } from "@/components/molecules/Toast";
import { Drawer } from "@/components/organisms/Drawer";
import { NavBar } from "@/components/organisms/NavBar";
import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { useUiStore } from "@/stores/ui.store";

interface AppLayoutProps {
	children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
	const toasts = useUiStore((s) => s.toasts);
	const [drawerOpen, setDrawerOpen] = useState(false);
	useAndroidBackButton();

	return (
		<div className="bg-surface-page min-h-screen min-w-screen max-w-screen text-text-primary pt-[env(safe-area-inset-top)]">
			<div className="relative">
				<div className="absolute top-0 left-0 right-0 pointer-events-none">
					{toasts.map((toast) => (
						<Toast key={toast.id} {...toast} />
					))}
				</div>
				<main className="pt-4 px-4 pb-[calc(7vh+1.5rem)]">{children}</main>
			</div>
			<NavBar onMenuOpen={() => setDrawerOpen(true)} />
			<Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
		</div>
	);
};
