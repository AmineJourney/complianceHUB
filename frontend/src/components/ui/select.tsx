import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const selectTriggerVariants = cva(
  "flex items-center justify-between w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500",
  {
    variants: {
      variant: {
        default: "",
        error: "border-red-500 focus:ring-red-500 focus:border-red-500",
      },
      size: {
        default: "py-2 px-3",
        sm: "py-1 px-2 text-sm",
        lg: "py-3 px-4 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Select = ({
  value,
  onValueChange,
  children,
  className,
}: SelectProps) => {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(selectTriggerVariants())}
        onClick={() => setOpen(!open)}
      >
        <span>
          {children && value ? (
            children
          ) : (
            <span className="text-gray-400">Select...</span>
          )}
        </span>
        <svg
          className="h-4 w-4 ml-2 text-gray-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.19l3.71-3.96a.75.75 0 111.08 1.04l-4.25 4.53a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg">
          {React.Children.map(children, (child) => {
            if (!React.isValidElement(child)) return null;
            return React.cloneElement(child, {
              onClick: (e: any) => {
                onValueChange?.(child.props.value);
                setOpen(false);
                child.props.onClick?.(e);
              },
            });
          })}
        </div>
      )}
    </div>
  );
};

export const SelectTrigger: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <>{children}</>;
};

export const SelectContent: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <>{children}</>;
};

export const SelectValue: React.FC<{ placeholder?: string }> = ({
  placeholder,
}) => {
  return <span className={cn("text-gray-500")}>{placeholder}</span>;
};

export const SelectItem: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { value: string }
> = ({ children, value, ...props }) => {
  return (
    <div
      {...props}
      className="cursor-pointer px-3 py-2 hover:bg-gray-100 text-sm"
      data-value={value}
    >
      {children}
    </div>
  );
};
