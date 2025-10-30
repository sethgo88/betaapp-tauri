import { twMerge } from 'tailwind-merge';

type BaseSelectAttributes = React.ComponentProps<'select'>;

interface SelectProps extends BaseSelectAttributes {
  className?: string;
  selectClassName?: string;
}

export const FormSelect = (props: SelectProps) => {
  const { className, selectClassName, ...rest } = props;
  return (
    <div className={twMerge("rounded-md bg-stone-800 p-2 font-bold w-full", className)}>
      <select
        className={twMerge(
          'outline-0 w-full',
          selectClassName
        )}
        {...rest}
      />
    </div>
  );
};
