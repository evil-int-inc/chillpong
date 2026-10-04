import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "ghost" | "outline" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  outline: "btn-outline",
  danger: "btn-error",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
  icon: "btn-square btn-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        data-ocid="button"
        className={cn(
          "btn transition-smooth",
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && "btn-block",
          className,
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading</span>
          </>
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
