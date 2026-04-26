"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useExecutions, useWorkflows } from "@/lib/dashboard-cache";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dayKey(ts: number): string {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function niceDay(key: string): string {
  const d = new Date(key);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const {
    data: workflows,
    loading: loadingW,
    error: workflowsError,
  } = useWorkflows(user?.uid);
  const {
    data: executions,
    loading: loadingE,
    error: executionsError,
  } = useExecutions(user?.uid, 500);
  const loading = loadingW || loadingE;
  const error = workflowsError || executionsError;
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [now] = useState(() => Date.now());

  const inWindow = useMemo(() => {
    const cutoff = now - days * MS_PER_DAY;
    return executions.filter((e) => e.startedAt >= cutoff);
  }, [executions, days, now]);

  const totals = useMemo(() => {
    const completed = inWindow.filter((e) => e.status === "completed").length;
    const failed = inWindow.filter((e) => e.status === "failed").length;
    const running = inWindow.filter((e) => e.status === "running").length;
    const successRate =
      completed + failed === 0
        ? 0
        : Math.round((completed / (completed + failed)) * 100);
    const durations = inWindow
      .filter((e) => e.completedAt && e.status !== "running")
      .map((e) => (e.completedAt! - e.startedAt) / 1000);
    const avg =
      durations.length === 0
        ? 0
        : durations.reduce((a, b) => a + b, 0) / durations.length;
    return { completed, failed, running, successRate, avg };
  }, [inWindow]);

  const daily = useMemo(() => {
    const map = new Map<string, { completed: number; failed: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const k = dayKey(now - i * MS_PER_DAY);
      map.set(k, { completed: 0, failed: 0 });
    }
    inWindow.forEach((e) => {
      const k = dayKey(e.startedAt);
      const slot = map.get(k);
      if (!slot) return;
      if (e.status === "completed") slot.completed++;
      else if (e.status === "failed") slot.failed++;
    });
    return Array.from(map.entries()).map(([k, v]) => ({ day: k, ...v }));
  }, [inWindow, days, now]);

  const topWorkflows = useMemo(() => {
    const counts = new Map<string, { name: string; runs: number; failed: number }>();
    inWindow.forEach((e) => {
      const cur = counts.get(e.workflowId) || {
        name: e.workflowName,
        runs: 0,
        failed: 0,
      };
      cur.runs++;
      if (e.status === "failed") cur.failed++;
      counts.set(e.workflowId, cur);
    });
    return Array.from(counts.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 6);
  }, [inWindow]);

  const maxDaily = Math.max(
    1,
    ...daily.map((d) => d.completed + d.failed)
  );

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Success rates and run volume across all workflows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {([7, 14, 30] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDays(n)}
              className={
                "rounded-full px-3 py-1 text-xs " +
                (days === n
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300")
              }
            >
              last {n}d
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error.message}
        </div>
      ) : loading ? (
        <p className="text-sm text-zinc-500">loading...</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total runs" value={inWindow.length} />
            <Stat
              label="Success rate"
              value={`${totals.successRate}%`}
              tone={totals.successRate >= 90 ? "good" : totals.successRate >= 70 ? "warn" : "bad"}
            />
            <Stat label="Failed" value={totals.failed} tone={totals.failed > 0 ? "bad" : undefined} />
            <Stat label="Avg. duration" value={`${totals.avg.toFixed(1)}s`} />
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Runs per day</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Green = completed, red = failed.
            </p>
            <div className="mt-6 flex h-40 items-end gap-2">
              {daily.map((d) => {
                const total = d.completed + d.failed;
                const h = (total / maxDaily) * 100;
                const okPart = total === 0 ? 0 : (d.completed / total) * 100;
                return (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="flex w-full flex-col overflow-hidden rounded-t-md"
                        style={{ height: `${h}%`, minHeight: total > 0 ? 4 : 0 }}
                        title={`${d.completed} completed, ${d.failed} failed`}
                      >
                        <div
                          className="bg-red-500"
                          style={{ height: `${100 - okPart}%` }}
                        />
                        <div
                          className="bg-emerald-500"
                          style={{ height: `${okPart}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {niceDay(d.day)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold">Most-run workflows</h2>
              <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {topWorkflows.length === 0 ? (
                  <p className="py-6 text-sm text-zinc-500">No runs.</p>
                ) : (
                  topWorkflows.map((w) => {
                    const rate =
                      w.runs === 0 ? 0 : Math.round(((w.runs - w.failed) / w.runs) * 100);
                    return (
                      <div
                        key={w.id}
                        className="flex items-center justify-between py-3 text-sm"
                      >
                        <div>
                          <div className="font-medium">{w.name}</div>
                          <div className="text-xs text-zinc-500">
                            {w.runs} runs · {w.failed} failed · {rate}% success
                          </div>
                        </div>
                        <div
                          className="h-2 w-24 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                          title={`${rate}% success`}
                        >
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold">Workflow health</h2>
              <div className="mt-3 space-y-2 text-sm">
                <Row
                  label="Total workflows"
                  value={String(workflows.length)}
                />
                <Row
                  label="Active"
                  value={String(
                    workflows.filter((w) => w.status === "active").length
                  )}
                />
                <Row
                  label="Drafts"
                  value={String(
                    workflows.filter((w) => w.status === "draft").length
                  )}
                />
                <Row
                  label="Scheduled"
                  value={String(
                    workflows.filter((w) => w.trigger.type === "schedule").length
                  )}
                />
                <Row
                  label="Currently running"
                  value={String(totals.running)}
                />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : tone === "bad"
          ? "text-red-600"
          : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-100 pb-2 last:border-b-0 dark:border-zinc-800">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
