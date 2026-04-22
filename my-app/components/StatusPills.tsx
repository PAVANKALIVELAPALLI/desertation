import type { Execution, Workflow } from "@/types/workflow";

export function StatusPill({ status }: { status: Workflow["status"] }) {
  const map = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    inactive: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  } as const;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${map[status]}`}
    >
      {status}
    </span>
  );
}

export function ExecutionPill({ status }: { status: Execution["status"] }) {
  const map = {
    completed:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    running: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  } as const;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${map[status]}`}
    >
      {status}
    </span>
  );
}
