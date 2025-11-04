import ToastList from "@/components/toast/toast-list";
import { twMerge } from "tailwind-merge";

const PageWrapper = ({ children, className }: { children: React.ReactNode, className?: string }) => {
    return (
        <div className={twMerge("pt-[7vh] px-[1vh] bg-stone-700 min-h-screen min-w-screen max-w-screen text-white", className)}>
            <div className="relative">
                <ToastList />
                {children}
            </div>
        </div>
    )
}

export default PageWrapper;