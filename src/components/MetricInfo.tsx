import * as React from "react";
import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MetricInfoProps {
  children: React.ReactNode;
  label?: React.ReactNode;
  className?: string;
  iconClassName?: string;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Inline info icon with a Popover, used next to column headers
 * or numeric metrics to explain what they mean / how they're calculated.
 */
export function MetricInfo({
  children,
  label,
  className,
  iconClassName,
  side = "top",
}: MetricInfoProps) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "ml-1 inline-flex items-center align-middle text-muted-foreground hover:text-foreground transition-colors",
          className,
        )}
        aria-label="Más información"
      >
        <InfoIcon className={cn("h-3.5 w-3.5", iconClassName)} />
      </PopoverTrigger>
      <PopoverContent
        side={side}
        className="w-72 text-xs leading-relaxed"
        onClick={(e) => e.stopPropagation()}
      >
        {label && (
          <div className="mb-1 font-semibold text-foreground">{label}</div>
        )}
        <div className="text-muted-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
