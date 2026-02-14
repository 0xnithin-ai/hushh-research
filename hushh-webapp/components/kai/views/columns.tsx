"use client";

import { ColumnDef } from "@tanstack/react-table";
import { AnalysisHistoryEntry } from "@/lib/services/kai-history-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ArrowRight, Trash2, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Extended type to include version number computed at runtime
export type HistoryEntryWithVersion = AnalysisHistoryEntry & {
  version: number;
};

interface ColumnsProps {
  onView: (entry: AnalysisHistoryEntry) => void;
  onDelete: (entry: AnalysisHistoryEntry) => void;
  onDeleteTicker: (ticker: string) => void;
  onViewVersions?: (ticker: string) => void;
}

export const getColumns = ({
  onView,
  onDelete,
  onDeleteTicker,
  onViewVersions,
}: ColumnsProps): ColumnDef<HistoryEntryWithVersion>[] => [
  {
    accessorKey: "ticker",
    header: "Ticker",
    cell: ({ row }) => {
      const entry = row.original;
      return (
        <div className="flex flex-col">
          <span className="font-bold text-base">{entry.ticker}</span>
          <span className="text-xs text-muted-foreground">v{entry.version}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "decision",
    header: "Decision",
    cell: ({ row }) => {
      const decision = row.original.decision.toLowerCase();
      let colorClass = "bg-muted text-muted-foreground border-border";
      
      if (decision === "buy") {
        colorClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      } else if (decision === "sell" || decision === "reduce") {
        colorClass = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30";
      } else if (decision === "hold") {
        colorClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      }

      return (
        <Badge variant="outline" className={cn("capitalize font-bold", colorClass)}>
          {decision}
        </Badge>
      );
    },
  },
  {
    accessorKey: "confidence",
    header: "Confidence",
    cell: ({ row }) => {
      const val = row.original.confidence;
      const percent = val >= 1 ? val : Math.round(val * 100);
      return (
        <div className="flex items-center gap-2">
           <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
             <div 
               className="h-full bg-primary" 
               style={{ width: `${percent}%` }}
             />
           </div>
           <span className="text-xs font-medium">{percent}%</span>
        </div>
      );
    },
  },
  {
    accessorKey: "timestamp",
    header: "Date",
    cell: ({ row }) => {
      return (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.timestamp), "MMM d, h:mm a")}
        </span>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const entry = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onView(entry)}>
              <Eye className="mr-2 h-4 w-4" />
              View Analysis
            </DropdownMenuItem>
            {onViewVersions && (
              <DropdownMenuItem onClick={() => onViewVersions(entry.ticker)}>
                <ArrowRight className="mr-2 h-4 w-4" />
                View Previous Versions
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(entry)}
              className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-500/10"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Entry
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteTicker(entry.ticker)}
              className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-500/10"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete All {entry.ticker}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
