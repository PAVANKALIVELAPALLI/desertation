"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getExecution, getExecutionLogs } from "@/lib/firestore";
import { ExecutionPill } from "@/components/StatusPills";
import type { Execution, ExecutionLog } from "@/types/workflow";

function fmt(ts: number | null) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function duration(e: Execution): string {
  if (!e.completedAt) return "still running";
  const ms = e.completedAt - e.startedAt;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default function ExecutionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();

  const [execution, setExecution] = useState<Execution | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    Promise.all([getExecution(id), getExecutionLogs(id)])
      .then(([e, l]) => {
        if (!alive) return;
        if (!e) {
          setNotFound(true);
          return;
        }
        setExecution(e);
        setLogs(l);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) return <p className="text-sm text-zinc-500">loading...</p>;

  if (notFound) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-500">Execution not found.</p>
        <Link
          href="/dashboard/executions"
          className="text-sm underline text-zinc-700 dark:text-zinc-300"
        >
          back to list
        </Link>
      </div>
    );
  }

  if (!execution || !user) return null;

  if (execution.userId !== user.uid) {
    return (
      <p className="text-sm text-red-600">
        You do not have access to this execution.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard/executions"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Back to executions
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {execution.workflowName}
          </h1>
          <ExecutionPill status={execution.status} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Meta label="Started" value={fmt(execution.startedAt)} />
        <Meta label="Finished" value={fmt(execution.completedAt)} />
        <Meta label="Duration" value={duration(execution)} />
        <Meta
          label="Progress"
          value={`${execution.stepsCompleted}/${execution.stepsTotal} steps`}
        />
      </div>

      {execution.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <span className="font-medium">Error: </span>
          {execution.error}
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
          Step-by-step log ({logs.length})
        </div>
        {logs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-zinc-500">
            No log entries.
          </p>
        ) : (
          <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {logs.map((log, i) => (
              <li key={log.id} className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{log.stepName}</span>
                    <LevelPill level={log.level} />
                  </div>
                  <span className="text-xs text-zinc-500">
                    {log.durationMs != null ? `${log.durationMs}ms · ` : ""}
                    {fmt(log.timestamp)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {log.message}
                </p>
                {log.error ? (
                  <p className="mt-1 text-xs text-red-600">
                    error: {log.error}
                  </p>
                ) : null}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-zinc-500 hover:underline">
                    show input / output
                  </summary>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <Pre label="input" data={log.input} />
                    <Pre label="output" data={log.output} />
                  </div>
                </details>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function LevelPill({ level }: { level: ExecutionLog["level"] }) {
  const map = {
    info: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    warn: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    error: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  } as const;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${map[level]}`}
    >
      {level}
    </span>
  );
}

function Pre({
  label,
  data,
}: {
  label: string;
  data: Record<string, unknown> | null;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <pre className="mt-1 overflow-auto rounded bg-zinc-50 p-2 text-[11px] leading-relaxed text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
        {data ? JSON.stringify(data, null, 2) : "-"}
      </pre>
    </div>
  );
}
