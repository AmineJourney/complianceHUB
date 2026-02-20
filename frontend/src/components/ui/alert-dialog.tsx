/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { cn } from "../../lib/utils";

/* -------------------------------------------------------------------------- */
/*                                   Context                                  */
/* -------------------------------------------------------------------------- */

interface AlertDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | null>(
  null,
);

function useAlertDialogContext() {
  const ctx = React.useContext(AlertDialogContext);
  if (!ctx) {
    throw new Error(
      "AlertDialog components must be used within <AlertDialog />",
    );
  }
  return ctx;
}

/* -------------------------------------------------------------------------- */
/*                                AlertDialog                                 */
/* -------------------------------------------------------------------------- */

interface AlertDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function AlertDialog({
  open: controlledOpen,
  onOpenChange,
  children,
}: AlertDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);

  const open = controlledOpen ?? uncontrolledOpen;

  const setOpen = (v: boolean) => {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(v);
    }
    onOpenChange?.(v);
  };

  return (
    <AlertDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

/* -------------------------------------------------------------------------- */
/*                             AlertDialogTrigger                              */
/* -------------------------------------------------------------------------- */

interface AlertDialogTriggerProps {
  asChild?: boolean;
  children: React.ReactElement;
}

export function AlertDialogTrigger({
  asChild,
  children,
}: AlertDialogTriggerProps) {
  const { setOpen } = useAlertDialogContext();

  if (asChild) {
    const child = children as React.ReactElement<{
      onClick?: React.MouseEventHandler;
    }>;

    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        child.props.onClick?.(e);
        setOpen(true);
      },
    });
  }

  return (
    <button type="button" onClick={() => setOpen(true)}>
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                             AlertDialogContent                              */
/* -------------------------------------------------------------------------- */

type AlertDialogContentProps = React.HTMLAttributes<HTMLDivElement>;

export function AlertDialogContent({
  className,
  children,
  ...props
}: AlertDialogContentProps) {
  const { open, setOpen } = useAlertDialogContext();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />

      {/* Content */}
      <div
        className={cn(
          "relative z-50 w-full max-w-lg rounded-lg bg-white p-6 shadow-lg",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             Structural Pieces                               */
/* -------------------------------------------------------------------------- */

export function AlertDialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4 space-y-2 text-left", className)} {...props} />
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg font-semibold text-gray-900", className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-gray-600", className)} {...props} />;
}

export function AlertDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Actions                                    */
/* -------------------------------------------------------------------------- */

export function AlertDialogAction({
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useAlertDialogContext();

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    />
  );
}

export function AlertDialogCancel({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useAlertDialogContext();

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50",
        className,
      )}
      onClick={() => setOpen(false)}
      {...props}
    />
  );
}
