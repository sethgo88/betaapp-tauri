import { FaTrashCan } from "react-icons/fa6";
import { GoTrash } from "react-icons/go";
import { RxCross1 } from "react-icons/rx";
import { twMerge } from "tailwind-merge";

export type DeleteButtonProps = React.ComponentPropsWithoutRef<"button"> & {
	iconClassName?: string;
	icon?: "FaTrashCan" | "RxCross1" | "GoTrash";
};

const getIconFromName = (iconName: string, iconClassName?: string) => {
	const className = "text-xl text-amber-50";
	switch (iconName) {
		case "FaTrashCan":
			return <FaTrashCan className={twMerge(className, iconClassName)} />;
		case "RxCross1":
			return <RxCross1 className={twMerge(className, iconClassName)} />;
		case "GoTrash":
			return <GoTrash className={twMerge(className, iconClassName)} />;
	}
};
export const DeleteButton = (props: DeleteButtonProps) => {
	const { className, icon, iconClassName, ...rest } = props;
	const iconComponent = getIconFromName(icon ?? "GoTrash", iconClassName);
	return (
		<div className="flex items-center justify-center">
			<button
				className={twMerge(
					"grid cursor-pointer rounded-full bg-yellow-950/30",
					className,
				)}
				{...rest}
				title="delete"
			>
				{iconComponent}
			</button>
		</div>
	);
};
