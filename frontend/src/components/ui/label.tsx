/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const labelVariants = cva("block text-sm font-medium text-gray-700", {
  variants: {
    variant: {
      default: "",
      small: "text-xs",
      large: "text-lg",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface LabelProps
  extends
    React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(labelVariants({ variant }), className)}
        {...props}
      />
    );
  },
);

Label.displayName = "Label";

export { Label, labelVariants };
