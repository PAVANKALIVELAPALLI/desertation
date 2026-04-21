"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useExecutions, useWorkflows } from "@/lib/dashboard-cache";
import { ExecutionPill, StatusPill } from "@/components/StatusPills";

type StatusCount = { completed: number; running: number; failed: number };

function formatWhen(ts: number | null | undefined): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

export default function DashboardOverview() {
  const { user } = useAuth();
  const { data: workflows, loading: loadingW } = useWorkflows(user?.uid);
  const { data: executions, loading: loadingE } = useExecutions(user?.uid, 50);
  const loading = loadingW || loadingE;

  const stats = useMemo(() => {
    const total = workflows.length;
    const active = workflows.filter((w) => w.status === "active").length;
    const counts: StatusCount = executions.reduce(
      (acc, e) => {
        if (e.status === "completed") acc.completed++;
        else if (e.status === "running") acc.running++;
        else if (e.status === "failed") acc.failed++;
        return acc;
      },
      { completed: 0, running: 0, failed: 0 },
    );
    return { total, active, ...counts };
  }, [workflows, executions]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {user?.email ? `Signed in as ${user.email}` : ""}
          </p>
        </div>
        <Link
          href="/dashboard/workflows/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        >
          + New workflow
        </Link>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Workflows"
          value={stats.total}
          hint={`${stats.active} active`}
        />
        <StatCard label="Runs (recent)" value={executions.length} />
        <StatCard label="Completed" value={stats.completed} tone="good" />
        <StatCard label="Failed" value={stats.failed} tone="bad" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your workflows</h2>
            <Link
              href="/dashboard/workflows"
              className="text-xs text-zinc-500 hover:underline"
            >
              view all →
            </Link>
          </div>
          <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading && workflows.length === 0 ? (
              <EmptyLine text="loading..." />
            ) : workflows.length === 0 ? (
              <EmptyLine text="No workflows yet." />
            ) : (
              workflows.slice(0, 5).map((w) => (
                <Link
                  key={w.id}
                  href={`/dashboard/workflows/${w.id}`}
                  className="flex items-center justify-between py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  <div>
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-zinc-500">
                      {w.steps.length} step{w.steps.length === 1 ? "" : "s"} ·{" "}
                      {w.trigger.type}
                    </div>
                  </div>
                  <StatusPill status={w.status} />
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent runs</h2>
            <Link
              href="/dashboard/executions"
              className="text-xs text-zinc-500 hover:underline"
            >
              view all →
            </Link>
          </div>
          <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
            {loading && executions.length === 0 ? (
              <EmptyLine text="loading..." />
            ) : executions.length === 0 ? (
              <EmptyLine text="No runs yet." />
            ) : (
              executions.slice(0, 5).map((e) => (
                <Link
                  key={e.id}
                  href={`/dashboard/executions/${e.id}`}
                  className="flex items-center justify-between py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  <div>
                    <div className="font-medium">{e.workflowName}</div>
                    <div className="text-xs text-zinc-500">
                      {formatWhen(e.startedAt)} · {e.triggeredBy}
                    </div>
                  </div>
                  <ExecutionPill status={e.status} />
                </Link>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "good" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-red-600"
        : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="py-6 text-sm text-zinc-500">{text}</p>;
}
