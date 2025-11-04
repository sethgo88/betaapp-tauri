import ToastContext, { ToastContextType, ToastType } from "@/components/toast/toast-context";
import { type ReactNode, useState } from "react";

type Props = { children: ReactNode };

export default function ToastContextProvider({ children }: Props) {
	const [toastList, setToastList] =
		useState<ToastContextType["toastList"]>([]);

    const addToast = (toast: ToastType) => {
        setToastList([...toastList, toast])
    }

    const removeToasts = () => {
        setToastList([])
    }

	const context: ToastContextType = {
        toastList,
        addToast,
        removeToasts
	};

	return <ToastContext.Provider value={context}>{children}</ToastContext.Provider>;
}
