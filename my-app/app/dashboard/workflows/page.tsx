"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  createWorkflowsBatch,
  deleteWorkflow,
  runWorkflowNow,
  updateWorkflow,
} from "@/lib/firestore";
import { SAMPLE_WORKFLOWS, materializeSample } from "@/lib/sample-workflows";
import {
  addWorkflowsToCache,
  patchWorkflowInCache,
  removeWorkflowFromCache,
  useWorkflows,
} from "@/lib/dashboard-cache";
import { StatusPill } from "@/components/StatusPills";
import type { Workflow } from "@/types/workflow";

function fmt(ts: number | null | undefined): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

export default function WorkflowsPage() {
  const { user } = useAuth();
  const { data: workflows, loading, error } = useWorkflows(user?.uid);

  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "draft">(
    "all",
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const visible = useMemo(
    () =>
      filter === "all"
        ? workflows
        : workflows.filter((w) => w.status === filter),
    [workflows, filter],
  );

  async function onRun(id: string, name: string) {
    setBusyId(id);
    setNotice(null);
    try {
      await runWorkflowNow(id);
      setNotice({ kind: "ok", text: `Triggered "${name}"` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "run failed";
      setNotice({ kind: "err", text: msg });
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleStatus(w: Workflow) {
    if (!w.id) return;
    const next = w.status === "active" ? "inactive" : "active";
    setBusyId(w.id);
    setNotice(null);
    patchWorkflowInCache(w.id, { status: next });
    try {
      await updateWorkflow(w.id, { status: next });
      setNotice({ kind: "ok", text: "Updated" });
    } catch (err: unknown) {
      patchWorkflowInCache(w.id, { status: w.status });
      const msg = err instanceof Error ? err.message : "update failed";
      setNotice({ kind: "err", text: msg });
    } finally {
      setBusyId(null);
    }
  }

  async function onLoadSamples() {
    if (!user) return;
    if (
      !confirm(
        `Load ${SAMPLE_WORKFLOWS.length} sample workflows into your account?`,
      )
    )
      return;

    setSeeding(true);
    setNotice(null);
    const docs = SAMPLE_WORKFLOWS.map((t) => materializeSample(t, user.uid));
    const optimistic = docs.map((d, i) => ({
      ...d,
      id: `tmp_${Date.now()}_${i}`,
    })) as Workflow[];
    addWorkflowsToCache(optimistic);

    try {
      await createWorkflowsBatch(docs);
      setNotice({
        kind: "ok",
        text: `Added ${docs.length} sample workflows`,
      });
    } catch (err: unknown) {
      optimistic.forEach((w) => {
        if (w.id) removeWorkflowFromCache(w.id);
      });
      const msg = err instanceof Error ? err.message : "seed failed";
      setNotice({ kind: "err", text: msg });
    } finally {
      setSeeding(false);
    }
  }

  async function onDelete(id: string, name: string) {
    const old = workflows.find((w) => w.id === id);
    if (!confirm(`Delete workflow "${name}"? This cannot be undone.`)) return;
    setBusyId(id);
    setNotice(null);
    removeWorkflowFromCache(id);
    try {
      await deleteWorkflow(id);
      setNotice({ kind: "ok", text: "Deleted" });
    } catch (err: unknown) {
      if (old) addWorkflowsToCache([old]);
      const msg = err instanceof Error ? err.message : "delete failed";
      setNotice({ kind: "err", text: msg });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Design, run, and monitor automations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLoadSamples}
            disabled={seeding}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {seeding ? "loading..." : "Load samples"}
          </button>
          <Link
            href="/dashboard/workflows/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            + New workflow
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(["all", "active", "inactive", "draft"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              "rounded-full px-3 py-1 text-xs " +
              (filter === f
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300")
            }
          >
            {f}
          </button>
        ))}
      </div>

      {notice ? (
        <div
          className={
            "rounded-md border px-3 py-2 text-sm " +
            (notice.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300")
          }
        >
          {notice.text}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error.message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {error ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            Could not load workflows.
          </div>
        ) : loading && workflows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            loading...
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-500">
            No workflows{filter !== "all" ? ` with status "${filter}"` : ""}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Trigger</th>
                <th className="px-4 py-3 text-left">Steps</th>
                <th className="px-4 py-3 text-left">Last run</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {visible.map((w) => (
                <tr
                  key={w.id}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/workflows/${w.id}`}
                      className="font-medium hover:underline"
                    >
                      {w.name}
                    </Link>
                    {w.description ? (
                      <div className="text-xs text-zinc-500">
                        {w.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {w.trigger.type}
                    {w.trigger.type === "schedule" && w.trigger.config.cron ? (
                      <span className="ml-1 text-xs text-zinc-400">
                        ({w.trigger.config.cron})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {w.steps.length}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {fmt(w.lastRunAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={w.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={busyId === w.id || w.status === "draft"}
                        onClick={() => w.id && onRun(w.id, w.name)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        title={
                          w.status === "draft"
                            ? "Activate the workflow before running"
                            : "Run now"
                        }
                      >
                        Run
                      </button>
                      <button
                        type="button"
                        disabled={busyId === w.id || w.status === "draft"}
                        onClick={() => onToggleStatus(w)}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        {w.status === "active" ? "Pause" : "Activate"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === w.id}
                        onClick={() => w.id && onDelete(w.id, w.name)}
                        className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        Delete
                      </button>
                    </div>
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
