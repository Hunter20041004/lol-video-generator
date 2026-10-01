import * as React from "react";
import { cn } from "@/lib/utils";

// shadcn/ui Textarea primitive, styled through the incumbent studio tokens.
function Textarea({ className, ...props }) {
  return <textarea data-slot="textarea" className={cn(
    "flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:border-destructive",
    className
  )} {...props} />;
}
export { Textarea };
