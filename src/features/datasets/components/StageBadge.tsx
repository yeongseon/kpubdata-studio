import type { StageStatus } from "@/shared/lib/builderApi";

const STATUS_CLASS: Record<StageStatus, string> = {
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  not_run: "bg-muted text-muted-foreground",
  unavailable: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export function StageBadge({ status }: { status: StageStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
      {status}
    </span>
  );
}
