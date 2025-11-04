
import ToastContext, { ToastType } from "@/components/toast/toast-context";
import { useContext, useEffect } from "react";
import { twMerge } from "tailwind-merge";

const Toast = ({ message, type, id }: ToastType) => {
  const { removeToasts } = useContext(ToastContext)
  useEffect(() => {
    setTimeout(() => {
      removeToasts();
    }, 2000);
  }, [id, removeToasts]);

  const getTypeStyles = () => {
    const typeStyles = {
      "success" : "text-emerald-900",
      "error" : "text-red-900",
      "warning" : "text-yellow-900"
    }
    return typeStyles[type];
  }

  return (
    <div className={twMerge("bg-amber-50 text-red drop-shadow-lg rounded-2xl text-emerald-900 absolute top-[2vh] left-[calc(50vw)] -translate-x-1/2 p-2.5 whitespace-nowrap", getTypeStyles())}>
      {message}
    </div>
  );
};

export default Toast;
