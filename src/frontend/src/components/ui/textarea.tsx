import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "textarea textarea-bordered min-h-16 w-full bg-base-100 text-base-content placeholder:text-base-content/50 focus:outline-none focus:ring-2 focus:ring-primary aria-invalid:textarea-error disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
