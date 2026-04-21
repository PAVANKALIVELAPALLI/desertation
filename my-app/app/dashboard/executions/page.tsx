"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useExecutions } from "@/lib/dashboard-cache";
import { ExecutionPill } from "@/components/StatusPills";
import type { Execution } from "@/types/workflow";

function fmt(ts: number | null) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function duration(e: Execution): string {
  if (!e.completedAt) return "-";
  const ms = e.completedAt - e.startedAt;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function ExecutionsPage() {
  const { user } = useAuth();
  const search = useSearchParams();
  const workflowFilter = search.get("workflow");

  const { data: executions, loading } = useExecutions(user?.uid, 200);
  const [status, setStatus] = useState<"all" | Execution["status"]>("all");

  const visible = useMemo(() => {
    let list = executions;
    if (workflowFilter)
      list = list.filter((e) => e.workflowId === workflowFilter);
    if (status !== "all") list = list.filter((e) => e.status === status);
    return list;
  }, [executions, workflowFilter, status]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Executions</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Every workflow run and its outcome.
          {workflowFilter ? (
            <>
              {" "}
              <Link
                href="/dashboard/executions"
                className="underline hover:no-underline"
              >
                clear workflow filter
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {(["all", "running", "completed", "failed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={
              "rounded-full px-3 py-1 text-xs " +
              (status === s
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300")
            }
          >
            {s}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {loading ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            loading...
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            No executions.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-3 text-left">Workflow</th>
                <th className="px-4 py-3 text-left">Started</th>
                <th className="px-4 py-3 text-left">Duration</th>
                <th className="px-4 py-3 text-left">Steps</th>
                <th className="px-4 py-3 text-left">Trigger</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visible.map((e) => (
                <tr
                  key={e.id}
                  className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/executions/${e.id}`}
                      className="font-medium hover:underline"
                    >
                      {e.workflowName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {fmt(e.startedAt)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {duration(e)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {e.stepsCompleted}/{e.stepsTotal}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {e.triggeredBy}
                  </td>
                  <td className="px-4 py-3">
                    <ExecutionPill status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
