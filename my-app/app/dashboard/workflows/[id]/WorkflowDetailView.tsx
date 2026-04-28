"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useUrlId } from "@/lib/use-url-id";
import { WorkflowEditor } from "@/components/WorkflowEditor";
import {
  deleteWorkflow,
  getWorkflow,
  getWorkflowExecutions,
  runWorkflowNow,
  updateWorkflow,
} from "@/lib/firestore";
import { ExecutionPill } from "@/components/StatusPills";
import type { Execution, Workflow } from "@/types/workflow";

function fmt(ts: number | null | undefined) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

export default function WorkflowDetailView() {
  const id = useUrlId("/dashboard/workflows");
  const router = useRouter();
  const { user } = useAuth();

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [recent, setRecent] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !user?.uid) return;
    const workflowId = id;
    const uid = user.uid;
    setLoading(true);
    setNotFound(false);
    setLoadError(null);
    try {
      const [wf, ex] = await Promise.all([
        getWorkflow(workflowId),
        getWorkflowExecutions(workflowId, uid, 10),
      ]);
      setWorkflow(wf);
      setRecent(ex);
      if (!wf) {
        setRecent([]);
        setNotFound(true);
      }
    } catch (err: unknown) {
      setWorkflow(null);
      setRecent([]);
      setLoadError(
        err instanceof Error ? err.message : "Failed to load workflow.",
      );
    } finally {
      setLoading(false);
    }
  }, [id, user?.uid]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-sm text-zinc-500">loading...</p>;
  }

  if (notFound) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-500">Workflow not found.</p>
        <Link
          href="/dashboard/workflows"
          className="text-sm underline text-zinc-700 dark:text-zinc-300"
        >
          back to list
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-red-600">{loadError}</p>
        <Link
          href="/dashboard/workflows"
          className="text-sm underline text-zinc-700 dark:text-zinc-300"
        >
          back to list
        </Link>
      </div>
    );
  }

  if (!workflow || !user) return null;

  if (workflow.userId !== user.uid) {
    return (
      <p className="text-sm text-red-600">
        You do not have access to this workflow.
      </p>
    );
  }

  async function handleRun() {
    if (!workflow?.id) return;
    setRunning(true);
    setNotice(null);
    try {
      await runWorkflowNow(workflow.id);
      setNotice({ kind: "ok", text: "Execution started" });
      setTimeout(() => {
        void load();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "run failed";
      setNotice({ kind: "err", text: msg });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/workflows"
            className="text-sm text-zinc-500 hover:underline"
          >
            ← Back to workflows
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {workflow.name}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Created {fmt(workflow.createdAt)} · Updated{" "}
            {fmt(workflow.updatedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRun}
          disabled={running || workflow.status === "draft"}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          title={
            workflow.status === "draft"
              ? "Activate the workflow before running"
              : "Trigger a manual run"
          }
        >
          {running ? "running..." : "Run now"}
        </button>
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

      <WorkflowEditor
        initial={workflow}
        saveLabel="Save changes"
        onSave={async (draft) => {
          if (!workflow.id) return;
          await updateWorkflow(workflow.id, draft);
          await load();
        }}
        onDelete={async () => {
          if (!workflow.id) return;
          await deleteWorkflow(workflow.id);
          router.push("/dashboard/workflows");
        }}
      />

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent runs</h2>
          <Link
            href={`/dashboard/executions?workflow=${workflow.id}`}
            className="text-xs text-zinc-500 hover:underline"
          >
            view all →
          </Link>
        </div>
        <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
          {recent.length === 0 ? (
            <p className="py-6 text-sm text-zinc-500">No runs yet.</p>
          ) : (
            recent.map((e) => (
              <Link
                key={e.id}
                href={`/dashboard/executions/${e.id}`}
                className="flex items-center justify-between py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
              >
                <div>
                  <div className="font-medium">{fmt(e.startedAt)}</div>
                  <div className="text-xs text-zinc-500">
                    {e.triggeredBy} · {e.stepsCompleted}/{e.stepsTotal} steps
                  </div>
                </div>
                <ExecutionPill status={e.status} />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
