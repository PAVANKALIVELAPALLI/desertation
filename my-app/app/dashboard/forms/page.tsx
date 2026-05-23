"use client";

import { useState } from "react";
import Link from "next/link";
import { addDoc, collection } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { getFirestore } from "@/lib/firebase";
import { useWorkflows } from "@/lib/dashboard-cache";

type PayloadRow = { id: string; key: string; value: string };

function newRow(): PayloadRow {
  return {
    id: Math.random().toString(36).slice(2, 9),
    key: "",
    value: "",
  };
}

const RESERVED_KEYS = new Set(["formId", "userId", "submittedAt"]);

export default function FormsPage() {
  const { user } = useAuth();
  const { data: workflows } = useWorkflows(user?.uid);
  const [formId, setFormId] = useState("newsletter-signup");
  const [rows, setRows] = useState<PayloadRow[]>([
    { id: "row-email", key: "email", value: "" },
    { id: "row-name", key: "name", value: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const formSubmitWorkflows = workflows.filter(
    (w) => w.trigger.type === "form_submit",
  );

  async function copyUid() {
    if (!user?.uid) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setResult({ kind: "ok", text: "UID copied to clipboard" });
    } catch {
      setResult({ kind: "err", text: "could not copy — copy manually" });
    }
  }

  function updateRow(id: string, patch: Partial<PayloadRow>) {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((r) => [...r, newRow()]);
  }

  function removeRow(id: string) {
    setRows((r) => r.filter((row) => row.id !== id));
  }

  async function submit() {
    if (!user) return;
    const trimmedFormId = formId.trim();
    if (!trimmedFormId) {
      setResult({ kind: "err", text: "Form ID is required" });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const payload: Record<string, string> = {};
      for (const r of rows) {
        const k = r.key.trim();
        if (!k || RESERVED_KEYS.has(k)) continue;
        payload[k] = r.value;
      }
      const ref = await addDoc(
        collection(getFirestore(), "formSubmissions"),
        {
          formId: trimmedFormId,
          userId: user.uid,
          submittedAt: Date.now(),
          ...payload,
        },
      );
      setResult({
        kind: "ok",
        text: `Submitted (doc ${ref.id}). Trigger should fire in a few seconds — check Executions.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "submit failed";
      setResult({ kind: "err", text: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Form tester</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Submit a doc into <code>formSubmissions</code> and watch your matching
          workflow fire.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">Your account</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Email:</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-500">User ID:</span>
            <code className="break-all rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs dark:bg-zinc-800">
              {user?.uid}
            </code>
            <button
              type="button"
              onClick={copyUid}
              className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              copy
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Every submission below is tagged with this UID automatically. A
          workflow only fires when its owner&apos;s UID matches.
        </p>
      </section>

      {formSubmitWorkflows.length > 0 ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold">
            Your form-triggered workflows
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Click &quot;use this&quot; to load a Form ID into the field below.
          </p>
          <div className="mt-3 space-y-2 text-sm">
            {formSubmitWorkflows.map((w) => {
              const id = w.trigger.config.formId;
              return (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <div>
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-zinc-500">
                      status: <code>{w.status}</code> · formId:{" "}
                      <code>{id || "(none set)"}</code>
                    </div>
                  </div>
                  {id ? (
                    <button
                      type="button"
                      onClick={() => setFormId(id)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      use this
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          You don&apos;t have any form-triggered workflows yet. Create one at{" "}
          <Link href="/dashboard/workflows/new" className="underline">
            New workflow
          </Link>{" "}
          (Trigger = Form submit) before submitting, otherwise nothing will
          fire.
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">Submit a form</h2>

        <div className="mt-4">
          <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Form ID
          </label>
          <input
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
            placeholder="newsletter-signup"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Must exactly match the Form ID configured on a workflow above.
          </p>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Payload fields
            </label>
            <button
              type="button"
              onClick={addRow}
              className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              + add field
            </button>
          </div>
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <input
                  value={row.key}
                  onChange={(e) => updateRow(row.id, { key: e.target.value })}
                  placeholder="field name"
                  className="w-1/3 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <input
                  value={row.value}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })}
                  placeholder="value"
                  className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  remove
                </button>
              </div>
            ))}
          </div>
          {rows.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">
              No payload fields. The submission will only carry formId, userId,
              and submittedAt.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">
            Fields <code>formId</code>, <code>userId</code>, and{" "}
            <code>submittedAt</code> are reserved — added automatically and any
            row using those names is ignored.
          </p>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !user}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? "submitting..." : "Submit"}
          </button>
          {result ? (
            <span
              className={
                "text-sm " +
                (result.kind === "ok"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400")
              }
            >
              {result.text}
            </span>
          ) : null}
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <p className="font-semibold text-zinc-700 dark:text-zinc-300">
          What happens when you submit
        </p>
        <ol className="mt-2 ml-4 list-decimal space-y-1">
          <li>
            A doc is created in the <code>formSubmissions</code> collection with
            your UID, the Form ID, and the payload fields above.
          </li>
          <li>
            The <code>onFormSubmission</code> Cloud Function fires within a few
            seconds.
          </li>
          <li>
            It looks up your <em>active</em> workflows whose trigger is{" "}
            <code>form_submit</code> and whose Form ID matches, then runs them.
          </li>
          <li>
            Check{" "}
            <Link href="/dashboard/executions" className="underline">
              Executions
            </Link>{" "}
            for the run. If nothing happens after ~30s, verify (a) the workflow
            is <em>active</em>, (b) the Form ID matches exactly, (c) your
            workflow has at least one step.
          </li>
        </ol>
      </section>
    </div>
  );
}
