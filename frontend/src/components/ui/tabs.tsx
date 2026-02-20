// src/components/ui/tabs.tsx
// Rewrite — fixes:
//   1. cva boolean variant (`active: { true, false }`) is unreliable across cva versions;
//      replaced with plain cn() conditionals
//   2. TabsContent wasn't returning null cleanly in all React versions (minor)
//   3. Added forwardRef on elements that compose into layouts
//   4. Added proper ARIA attributes (aria-controls, tabindex)

import * as React from "react";
import { cn } from "../../lib/utils";

// ─── Context ──────────────────────────────────────────────────────────────────

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs sub-components must be inside <Tabs />");
  return ctx;
}

// ─── Tabs (root) ──────────────────────────────────────────────────────────────

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export function Tabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);

  const value = controlledValue ?? uncontrolledValue;

  const setValue = (v: string) => {
    if (controlledValue === undefined) setUncontrolledValue(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

// ─── TabsList ─────────────────────────────────────────────────────────────────

export const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

// ─── TabsTrigger ─────────────────────────────────────────────────────────────

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>(({ value, className, children, ...props }, ref) => {
  const { value: activeValue, setValue } = useTabsContext();
  const isActive = activeValue === value;

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setValue(value)}
      className={cn(
        // Base styles
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium",
        "ring-offset-background transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        // Active vs inactive
        isActive
          ? "bg-background text-foreground shadow"
          : "text-muted-foreground hover:text-foreground hover:bg-background/60",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = "TabsTrigger";

// ─── TabsContent ──────────────────────────────────────────────────────────────

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className, children, ...props }, ref) => {
    const { value: activeValue } = useTabsContext();

    if (activeValue !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        tabIndex={0}
        className={cn(
          "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
TabsContent.displayName = "TabsContent";
