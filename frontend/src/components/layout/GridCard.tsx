import { forwardRef, type ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface GridCardProps {
  editing?: boolean;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const GridCard = forwardRef<HTMLDivElement, GridCardProps>(
  function GridCard({ editing, children, className, style, ...rest }, ref) {
    return (
      <div ref={ref} style={style} className={className} {...rest}>
        {/* `overflow-visible` on both wrappers lets chart tooltips render
            on top of adjacent cards instead of being clipped at the card
            edge. The drag handle still works because react-grid-layout
            positions absolutely. */}
        <Card className="h-full overflow-visible flex flex-col">
          {editing && (
            <div className="grid-drag-handle flex items-center justify-center border-b bg-muted/30 py-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted-foreground"
              >
                <circle cx="9" cy="5" r="1" />
                <circle cx="15" cy="5" r="1" />
                <circle cx="9" cy="12" r="1" />
                <circle cx="15" cy="12" r="1" />
                <circle cx="9" cy="19" r="1" />
                <circle cx="15" cy="19" r="1" />
              </svg>
            </div>
          )}
          <div className="flex-1 overflow-visible">{children}</div>
        </Card>
      </div>
    );
  },
);
