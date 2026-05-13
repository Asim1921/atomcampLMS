import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-atom-border bg-atom-panel text-atom-text",
        accent: "border-atom-accent/40 bg-atom-accent/10 text-atom-accent",
        warn: "border-atom-warn/40 bg-atom-warn/10 text-atom-warn",
        danger: "border-atom-danger/40 bg-atom-danger/10 text-atom-danger",
        outline: "border-atom-border/80 bg-transparent text-atom-muted",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
