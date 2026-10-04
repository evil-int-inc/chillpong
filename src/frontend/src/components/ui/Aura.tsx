import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AuraProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly gold?: boolean;
  readonly rainbow?: boolean;
  readonly disabled?: boolean;
}

export const Aura = ({
  children,
  className,
  gold = false,
  rainbow = false,
  disabled = false,
}: AuraProps) => {
  if (disabled) return children;

  return (
    <div
      className={cn(
        "aura",
        gold && "aura-gold",
        rainbow && "aura-rainbow",
        className,
      )}
    >
      {children}
    </div>
  );
};
