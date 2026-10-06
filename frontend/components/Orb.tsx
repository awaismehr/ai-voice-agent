import { cn } from "@/lib/utils";

export function Orb({ className }: { className?: string }) {
  return <span aria-hidden className={cn("orb block", className)} />;
}
