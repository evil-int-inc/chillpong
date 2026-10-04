import { cn } from "@/lib/utils";
import {
  type InputHTMLAttributes,
  type ReactNode,
  forwardRef,
  useId,
} from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Optional element rendered inside the input on the right (e.g. a search icon). */
  rightElement?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, rightElement, id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className="w-full">
        {label ? (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-base-content"
          >
            {label}
          </label>
        ) : null}

        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            data-ocid="input"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            className={cn(
              "input input-bordered w-full bg-base-100 text-base-content transition-smooth",
              "focus:outline-none focus:ring-2 focus:ring-primary",
              error && "input-error",
              rightElement && "pr-10",
              className,
            )}
            {...props}
          />
          {rightElement ? (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-base-content/60">
              {rightElement}
            </span>
          ) : null}
        </div>

        {error ? (
          <p id={errorId} className="mt-1.5 text-sm text-error">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="mt-1.5 text-sm text-base-content/60">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = "Input";
