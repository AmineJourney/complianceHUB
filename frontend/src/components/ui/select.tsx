// src/components/ui/select.tsx
// Full rewrite — the original had structural bugs:
//   1. SelectContent was rendered inside the trigger button
//   2. SelectValue never displayed the selected label
//   3. Click-outside didn't close the dropdown
//   4. disabled prop was ignored
//   5. React.Children.map scanned wrong level (siblings, not nested items)

import * as React from "react";
import { cn } from "../../lib/utils";
import { ChevronDown, Check } from "lucide-react";

// ─── Context ──────────────────────────────────────────────────────────────────

interface SelectContextValue {
  value: string | undefined;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  /** label of the currently selected item — set by SelectItem when it renders */
  selectedLabel: React.ReactNode;
  setSelectedLabel: (label: React.ReactNode) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelect() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error("Select sub-components must be inside <Select />");
  return ctx;
}

// ─── Select (root) ────────────────────────────────────────────────────────────

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Select({
  value: controlledValue,
  defaultValue,
  onValueChange,
  disabled = false,
  children,
  className,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<
    string | undefined
  >(defaultValue);
  const [open, setOpen] = React.useState(false);
  const [selectedLabel, setSelectedLabel] =
    React.useState<React.ReactNode>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const value =
    controlledValue !== undefined ? controlledValue : uncontrolledValue;

  const handleValueChange = (v: string) => {
    if (controlledValue === undefined) setUncontrolledValue(v);
    onValueChange?.(v);
    setOpen(false);
  };

  // Click outside to close
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Escape key to close
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <SelectContext.Provider
      value={{
        value,
        onValueChange: handleValueChange,
        open,
        setOpen,
        disabled,
        selectedLabel,
        setSelectedLabel,
      }}
    >
      <div ref={containerRef} className={cn("relative", className)}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

// ─── SelectTrigger ────────────────────────────────────────────────────────────

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  SelectTriggerProps
>(({ className, children, ...props }, ref) => {
  const { open, setOpen, disabled } = useSelect();

  return (
    <button
      ref={ref}
      type="button"
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      onClick={() => !disabled && setOpen(!open)}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm",
        "ring-offset-background placeholder:text-muted-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        open && "ring-2 ring-ring ring-offset-2",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className={cn(
          "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ml-2",
          open && "rotate-180",
        )}
      />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

// ─── SelectValue ─────────────────────────────────────────────────────────────

interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

export function SelectValue({ placeholder, className }: SelectValueProps) {
  const { value, selectedLabel } = useSelect();

  if (value && selectedLabel) {
    return <span className={cn("truncate", className)}>{selectedLabel}</span>;
  }

  return (
    <span className={cn("text-muted-foreground truncate", className)}>
      {placeholder ?? "Select…"}
    </span>
  );
}

// ─── SelectContent ────────────────────────────────────────────────────────────

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
  align?: "start" | "end";
}

export function SelectContent({
  children,
  className,
  align = "start",
}: SelectContentProps) {
  const { open } = useSelect();

  if (!open) return null;

  return (
    <div
      role="listbox"
      className={cn(
        "absolute z-50 mt-1 w-full min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      <div className="p-1 max-h-60 overflow-y-auto">{children}</div>
    </div>
  );
}

// ─── SelectItem ───────────────────────────────────────────────────────────────

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
}

export function SelectItem({
  value,
  disabled = false,
  className,
  children,
  ...props
}: SelectItemProps) {
  const ctx = useSelect();
  const isSelected = ctx.value === value;

  // Register this item's label whenever it's the selected value
  React.useEffect(() => {
    if (isSelected) {
      ctx.setSelectedLabel(children);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected, children]);

  return (
    <div
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled}
      data-value={value}
      onClick={() => {
        if (!disabled) {
          ctx.onValueChange(value);
        }
      }}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
        isSelected
          ? "bg-accent text-accent-foreground font-medium"
          : "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
      {...props}
    >
      {/* Checkmark for selected item */}
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4" />}
      </span>
      {children}
    </div>
  );
}

// ─── SelectGroup / SelectLabel / SelectSeparator (bonus) ──────────────────────

export function SelectGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="group" className={cn("py-0.5", className)}>
      {children}
    </div>
  );
}

export function SelectLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-8 py-1.5 text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SelectSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />;
}
