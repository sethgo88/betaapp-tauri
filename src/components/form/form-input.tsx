import { twMerge } from "tailwind-merge";

type BaseInputAttributes = React.ComponentPropsWithoutRef<"input">;

interface InputProps extends BaseInputAttributes {
  className?: string;
  errorState?: boolean;
}

export const FormInput = (props: InputProps) => {
  const { className, errorState, ...rest } = props;
  return (
    <input
      className={twMerge(
        "rounded-lg bg-stone-800 p-2 font-bold outline-0 w-full border border-stone-900",
        className,
        errorState && "border-red-500 placeholder:text-red-400"
      )}
      {...rest}
    />
  );
};