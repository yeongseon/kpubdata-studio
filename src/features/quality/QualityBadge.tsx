import type { ValidationStatus } from "./model";

const STATUS_CLASS: Record<ValidationStatus, string> = {
  PASS: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  WARN: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  FAIL: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  "N/A": "bg-muted text-muted-foreground",
};

export function QualityBadge({ status }: { status: ValidationStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
      {status}
    </span>
  );
}
