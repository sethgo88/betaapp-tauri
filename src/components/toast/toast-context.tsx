import { createContext } from "react";

export type ToastType = {
  id: string;
  message: string;
  type: "success" | "error" | "warning";
};
export type ToastContextType = {
    toastList: ToastType[];
    addToast: (Toast: ToastType) => void;
    removeToasts: () => void;
};

const ToastContext = createContext<ToastContextType>({} as ToastContextType);

export default ToastContext;
