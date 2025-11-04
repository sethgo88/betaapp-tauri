"use client";
import Toast from "@/components/toast/toast";
import ToastContext from "@/components/toast/toast-context";
import { useContext } from "react";

const ToastList = () => {
  const { toastList } = useContext(ToastContext) 
  return (
    <div className="absolute top-0">
      {toastList.map((toast, i) => (
        <Toast
          key={i}
          message={toast.message}
          type={toast.type}
          id={toast.id}
        />
      ))}
    </div>
  );
};

export default ToastList;
