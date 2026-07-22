import { useEffect, useRef } from "react";
import { useUiStore } from "@/stores/ui.store";

const FOCUSABLE_SELECTOR =
	'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared a11y behavior for full-screen sheets and modal dialogs:
 * - Traps Tab/Shift+Tab focus inside the dialog while open
 * - Focuses the first focusable element on open, restores focus to the trigger on close
 * - Escape key closes the dialog
 * - Registers with useAndroidBackButton's override so the hardware back button closes
 *   the dialog instead of navigating the router
 *
 * Attach the returned ref to the dialog's outer container (it needs `tabIndex={-1}`
 * so it can receive focus as a fallback when there are no focusable children).
 */
export function useDialogA11y(isOpen: boolean, onClose: () => void) {
	const containerRef = useRef<HTMLDivElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);
	const setBackHandlerOverride = useUiStore((s) => s.setBackHandlerOverride);

	useEffect(() => {
		if (!isOpen) return;

		previousFocusRef.current = document.activeElement as HTMLElement | null;
		setBackHandlerOverride(onClose);

		const container = containerRef.current;
		const focusable =
			container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
		(focusable?.[0] ?? container)?.focus();

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
				return;
			}
			if (e.key !== "Tab" || !container) return;
			const items = Array.from(
				container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
			);
			if (items.length === 0) return;
			const first = items[0];
			const last = items[items.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			setBackHandlerOverride(null);
			previousFocusRef.current?.focus?.();
		};
	}, [isOpen, onClose, setBackHandlerOverride]);

	return containerRef;
}
