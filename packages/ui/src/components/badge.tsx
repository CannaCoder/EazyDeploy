import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[11px] font-medium tracking-tight transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-white/10 bg-white/[0.04] text-zinc-300",
        secondary:
          "border-zinc-800 bg-zinc-900 text-zinc-400",
        destructive:
          "border-zinc-700 bg-zinc-900 text-zinc-300",
        outline:
          "border-white/15 text-foreground bg-transparent",
        success:
          "border-white/15 bg-white/[0.05] text-zinc-200 font-mono text-emerald-500",
        warning:
          "border-white/15 bg-white/[0.05] text-zinc-300 font-mono text-amber-500",
        info:
          "border-white/10 bg-white/[0.03] text-zinc-400 font-mono",
        purple:
          "border-white/10 bg-white/[0.03] text-zinc-400 font-mono",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full bg-white",
            variant === "destructive" && "bg-zinc-400"
          )}
        />
      )}
      {children}
    </div>
  );
}

export { badgeVariants };
