"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
};

export function OtpInput({ value, onChange, length = 6, disabled, autoFocus }: Props) {
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);

  React.useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function set(idx: number, char: string) {
    const c = char.replace(/[^0-9]/g, "").slice(-1);
    const arr = value.split("");
    while (arr.length < length) arr.push("");
    arr[idx] = c;
    onChange(arr.join("").slice(0, length));
    if (c && idx < length - 1) refs.current[idx + 1]?.focus();
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === "Backspace" && !value[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) refs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < length - 1) refs.current[idx + 1]?.focus();
  }

  function onPaste(e: React.ClipboardEvent) {
    const txt = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (txt) {
      e.preventDefault();
      onChange(txt.padEnd(length, "").slice(0, length));
      const next = Math.min(txt.length, length - 1);
      refs.current[next]?.focus();
    }
  }

  return (
    <div className="flex gap-2" onPaste={onPaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => onKey(e, i)}
          className={cn(
            "h-14 w-12 rounded-xl border border-atom-border/80 bg-atom-deep/70 text-center text-2xl font-semibold text-atom-text",
            "transition focus:border-atom-accent/70 focus:shadow-[0_0_0_3px_rgba(45,212,191,0.18)] focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      ))}
    </div>
  );
}
