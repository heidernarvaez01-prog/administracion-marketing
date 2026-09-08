import * as React from "react";
import { InfoIcon, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface TypeTableItem {
  description?: React.ReactNode;
  type: string;
  typeDescription?: React.ReactNode;
  typeDescriptionLink?: string;
  default?: string;
}

interface TypeTableProps extends React.HTMLAttributes<HTMLDivElement> {
  type: Record<string, TypeTableItem>;
}

function Info({ children }: { children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger className="ml-1 inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
        <InfoIcon className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent className="text-sm" side="top">
        {children}
      </PopoverContent>
    </Popover>
  );
}

export function TypeTable({ type, className, ...props }: TypeTableProps) {
  return (
    <div
      className={cn(
        "my-4 overflow-x-auto rounded-md border bg-card",
        className,
      )}
      {...props}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-muted-foreground">
            <th className="px-4 py-2 font-medium">Prop</th>
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Default</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(type).map(([key, value]) => (
            <tr key={key} className="border-b last:border-0 align-top">
              <td className="px-4 py-3">
                <div className="flex items-center">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    {key}
                  </code>
                  {value.description && <Info>{value.description}</Info>}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">
                    {value.type}
                  </code>
                  {value.typeDescription && (
                    <Info>{value.typeDescription}</Info>
                  )}
                  {value.typeDescriptionLink && (
                    <a
                      href={value.typeDescriptionLink}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 text-muted-foreground hover:text-foreground"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                {value.default ? (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {value.default}
                  </code>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
