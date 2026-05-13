"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string | null;
  icon?: React.ReactNode;
};

export const Field = React.forwardRef<HTMLInputElement, Props>(function Field(
  { label, hint, error, icon, type = "text", className, ...rest }, ref,
) {
  const [show, setShow] = React.useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword && show ? "text" : type;

  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium uppercase tracking-wide text-atom-muted">{label}</span>
      <div
        className={cn(
          "group relative flex items-center rounded-xl border border-atom-border/80 bg-atom-deep/70 transition-all",
          "focus-within:border-atom-accent/60 focus-within:shadow-[0_0_0_3px_rgba(45,212,191,0.18)]",
          error && "border-atom-danger/60 focus-within:shadow-[0_0_0_3px_rgba(248,113,113,0.18)]",
        )}
      >
        {icon && <span className="pl-3 text-atom-muted">{icon}</span>}
        <input
          ref={ref}
          type={effectiveType}
          className={cn(
            "h-11 w-full bg-transparent px-3 text-sm text-atom-text placeholder:text-atom-muted/60 focus:outline-none",
            isPassword && "pr-10",
            className,
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 grid h-8 w-8 place-items-center rounded-md text-atom-muted hover:bg-atom-panel hover:text-atom-text"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? (
        <span className="block text-xs text-atom-danger">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-atom-muted/80">{hint}</span>
      ) : null}
    </label>
  );
});
