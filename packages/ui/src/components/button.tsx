import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs sm:text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground font-semibold hover:bg-zinc-200 shadow-sm",
        primary:
          "bg-primary text-primary-foreground font-semibold hover:bg-zinc-200 shadow-sm",
        gradient:
          "bg-primary text-primary-foreground font-semibold hover:bg-zinc-200 shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline:
          "border border-white/10 bg-transparent text-zinc-300 hover:bg-white/[0.06] hover:text-white hover:border-white/20",
        secondary:
          "bg-secondary text-secondary-foreground border border-zinc-800 hover:bg-zinc-800 hover:text-white shadow-sm",
        ghost:
          "hover:bg-accent hover:text-accent-foreground text-zinc-400 hover:text-white",
        link:
          "text-white underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 sm:h-9 px-3.5 sm:px-4 py-2",
        sm: "h-7 sm:h-8 rounded px-2.5 sm:px-3 text-xs",
        lg: "h-10 sm:h-11 rounded px-5 sm:px-6 text-sm",
        icon: "h-8 sm:h-9 w-8 sm:w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
