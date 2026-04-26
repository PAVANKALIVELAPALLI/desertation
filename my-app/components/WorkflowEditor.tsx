"use client";

import { useMemo, useState } from "react";
import type {
  StepType,
  TriggerType,
  Workflow,
  WorkflowStep,
} from "@/types/workflow";
import {
  STEP_TYPE_META,
  TRIGGER_TYPE_META,
} from "@/types/workflow";
import {
  blankStep,
  defaultStepConfig,
  validateCron,
  validateWorkflow,
} from "@/lib/workflow-schema";

type Draft = Omit<Workflow, "id"> & { id?: string };

export function WorkflowEditor({
  initial,
  onSave,
  onDelete,
  saveLabel = "Save",
}: {
  initial: Draft;
  onSave: (w: Draft) => Promise<void>;
  onDelete?: () => Promise<void>;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const stepIdOptions = useMemo(
    () =>
      draft.steps.map((s, index) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        order: s.order,
        index,
      })),
    [draft.steps],
  );

  function patch(update: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...update }));
  }

  function patchStep(id: string, update: Partial<WorkflowStep>) {
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s) => (s.id === id ? { ...s, ...update } : s)),
    }));
  }

  function patchStepConfig(
    id: string,
    update: Partial<WorkflowStep["config"]>
  ) {
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s) =>
        s.id === id ? { ...s, config: { ...s.config, ...update } } : s
      ),
    }));
  }

  function addStep() {
    setDraft((d) => ({
      ...d,
      steps: [...d.steps, blankStep(d.steps.length)],
    }));
  }

  function clearStepRefs(step: WorkflowStep, id: string): WorkflowStep {
    if (step.type !== "condition") return step;
    return {
      ...step,
      config: {
        ...step.config,
        onTrueStepId:
          step.config.onTrueStepId === id ? undefined : step.config.onTrueStepId,
        onFalseStepId:
          step.config.onFalseStepId === id
            ? undefined
            : step.config.onFalseStepId,
      },
    };
  }

  function removeStep(id: string) {
    setDraft((d) => ({
      ...d,
      steps: d.steps
        .filter((s) => s.id !== id)
        .map((s) => clearStepRefs(s, id))
        .map((s, i) => ({ ...s, order: i })),
    }));
  }

  function moveStep(id: string, dir: -1 | 1) {
    setDraft((d) => {
      const idx = d.steps.findIndex((s) => s.id === id);
      if (idx < 0) return d;
      const swap = idx + dir;
      if (swap < 0 || swap >= d.steps.length) return d;
      const arr = [...d.steps];
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
      return { ...d, steps: arr.map((s, i) => ({ ...s, order: i })) };
    });
  }

  async function handleSave() {
    setNotice(null);
    const result = validateWorkflow(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setBusy(true);
    try {
      await onSave({ ...draft, updatedAt: Date.now() });
      setNotice("Saved");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "save failed";
      setErrors([msg]);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    if (!confirm(`Delete workflow "${draft.name}"?`)) return;
    setErrors([]);
    setNotice(null);
    setBusy(true);
    try {
      await onDelete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "delete failed";
      setErrors([msg]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              className={textInput}
            />
          </Field>
          <Field label="Status">
            <select
              value={draft.status}
              onChange={(e) =>
                patch({ status: e.target.value as Workflow["status"] })
              }
              className={textInput}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea
                rows={2}
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
                className={textInput}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold">Trigger</h2>
        <p className="mt-1 text-xs text-zinc-500">
          What starts the workflow.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <select
              value={draft.trigger.type}
              onChange={(e) =>
                patch({
                  trigger: {
                    ...draft.trigger,
                    type: e.target.value as TriggerType,
                  },
                })
              }
              className={textInput}
            >
              {(Object.keys(TRIGGER_TYPE_META) as TriggerType[]).map((t) => (
                <option key={t} value={t}>
                  {TRIGGER_TYPE_META[t].label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              {TRIGGER_TYPE_META[draft.trigger.type].description}
            </p>
          </Field>
          {draft.trigger.type === "schedule" ? (
            <Field label="Cron expression">
              <input
                value={draft.trigger.config.cron || ""}
                onChange={(e) =>
                  patch({
                    trigger: {
                      ...draft.trigger,
                      config: { ...draft.trigger.config, cron: e.target.value },
                    },
                  })
                }
                placeholder="*/5 * * * *"
                className={textInput}
              />
              <CronHint value={draft.trigger.config.cron || ""} />
            </Field>
          ) : null}
          {draft.trigger.type === "form_submit" ? (
            <Field label="Form ID">
              <input
                value={draft.trigger.config.formId || ""}
                onChange={(e) =>
                  patch({
                    trigger: {
                      ...draft.trigger,
                      config: {
                        ...draft.trigger.config,
                        formId: e.target.value,
                      },
                    },
                  })
                }
                className={textInput}
              />
            </Field>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Steps</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Executed in order. Condition steps can branch via on-true /
              on-false targets.
            </p>
          </div>
          <button
            type="button"
            onClick={addStep}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            + Add step
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {draft.steps.map((step, i) => (
            <StepCard
              key={step.id}
              step={step}
              index={i}
              total={draft.steps.length}
              stepOptions={stepIdOptions.filter((o) => o.id !== step.id)}
              onMove={(d) => moveStep(step.id, d)}
              onRemove={() => removeStep(step.id)}
              onChange={(u) => patchStep(step.id, u)}
              onChangeConfig={(u) => patchStepConfig(step.id, u)}
            />
          ))}
        </div>
      </div>

      {errors.length > 0 ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-medium">Fix these before saving:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        {onDelete ? (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete workflow
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {busy ? "saving..." : saveLabel}
        </button>
      </div>
    </div>
  );
}

const textInput =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function CronHint({ value }: { value: string }) {
  if (!value) {
    return (
      <p className="mt-1 text-xs text-zinc-500">
        e.g. <code>*/5 * * * *</code> runs every 5 minutes.
      </p>
    );
  }
  const ok = validateCron(value);
  return (
    <p
      className={
        "mt-1 text-xs " +
        (ok
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400")
      }
    >
      {ok ? "✓ valid cron" : "✗ not a valid 5-field cron expression"}
    </p>
  );
}

function StepCard({
  step,
  index,
  total,
  stepOptions,
  onMove,
  onRemove,
  onChange,
  onChangeConfig,
}: {
  step: WorkflowStep;
  index: number;
  total: number;
  stepOptions: StepOption[];
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onChange: (u: Partial<WorkflowStep>) => void;
  onChangeConfig: (u: Partial<WorkflowStep["config"]>) => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            {index + 1}
          </span>
          <input
            value={step.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="bg-transparent text-sm font-medium outline-none"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs disabled:opacity-30 dark:border-zinc-700"
            title="move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs disabled:opacity-30 dark:border-zinc-700"
            title="move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={total <= 1}
            className="rounded-md border border-red-300 px-2 py-0.5 text-xs text-red-700 disabled:opacity-30 dark:border-red-900 dark:text-red-400"
          >
            remove
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Type">
          <select
            value={step.type}
            onChange={(e) => {
              const nextType = e.target.value as StepType;
              onChange({
                type: nextType,
                config: defaultStepConfig(nextType, step.name),
              });
            }}
            className={textInput}
          >
            {(Object.keys(STEP_TYPE_META) as StepType[]).map((t) => (
              <option key={t} value={t}>
                {STEP_TYPE_META[t].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <input
            type="number"
            value={step.priority ?? 0}
            onChange={(e) =>
              onChange({ priority: Number(e.target.value) || 0 })
            }
            className={textInput}
          />
        </Field>
        <Field label="Retries">
          <input
            type="number"
            min={0}
            max={5}
            value={step.retries ?? 0}
            onChange={(e) =>
              onChange({
                retries: Math.max(0, Math.min(5, Number(e.target.value) || 0)),
              })
            }
            className={textInput}
          />
        </Field>
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        {STEP_TYPE_META[step.type].description}
      </p>

      <div className="mt-4">
        <StepConfigFields
          step={step}
          stepOptions={stepOptions}
          onChangeConfig={onChangeConfig}
        />
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={step.continueOnError ?? false}
          onChange={(e) => onChange({ continueOnError: e.target.checked })}
        />
        Continue workflow even if this step fails
      </label>
    </div>
  );
}

function StepConfigFields({
  step,
  stepOptions,
  onChangeConfig,
}: {
  step: WorkflowStep;
  stepOptions: StepOption[];
  onChangeConfig: (u: Partial<WorkflowStep["config"]>) => void;
}) {
  const c = step.config;
  switch (step.type) {
    case "send_notification": {
      const channel = c.notificationChannel || "app";
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Channel">
              <select
                value={channel}
                onChange={(e) =>
                  onChangeConfig({
                    notificationChannel: e.target.value as "app" | "email",
                  })
                }
                className={textInput}
              >
                <option value="app">App log</option>
                <option value="email">Email</option>
              </select>
            </Field>
            {channel === "email" ? (
              <Field label="Email to">
                <input
                  type="email"
                  value={c.emailTo || ""}
                  onChange={(e) => onChangeConfig({ emailTo: e.target.value })}
                  className={textInput}
                />
              </Field>
            ) : null}
          </div>
          {channel === "email" ? (
            <Field label="Email subject">
              <input
                value={c.emailSubject || ""}
                onChange={(e) =>
                  onChangeConfig({ emailSubject: e.target.value })
                }
                className={textInput}
              />
            </Field>
          ) : null}
          <Field label={channel === "email" ? "Email body" : "Message"}>
            <textarea
              rows={3}
              value={c.message || ""}
              onChange={(e) => onChangeConfig({ message: e.target.value })}
              className={textInput}
            />
          </Field>
        </div>
      );
    }
    case "log_event":
      return (
        <Field label="Message">
          <input
            value={c.message || ""}
            onChange={(e) => onChangeConfig({ message: e.target.value })}
            className={textInput}
          />
        </Field>
      );
    case "update_record":
      return (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Collection">
            <input
              value={c.collection || ""}
              onChange={(e) => onChangeConfig({ collection: e.target.value })}
              className={textInput}
            />
          </Field>
          <Field label="Field">
            <input
              value={c.field || ""}
              onChange={(e) => onChangeConfig({ field: e.target.value })}
              className={textInput}
            />
          </Field>
          <Field label="Value">
            <input
              value={c.value || ""}
              onChange={(e) => onChangeConfig({ value: e.target.value })}
              className={textInput}
            />
          </Field>
        </div>
      );
    case "condition":
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Field (from context)">
              <input
                value={c.conditionField || ""}
                onChange={(e) =>
                  onChangeConfig({ conditionField: e.target.value })
                }
                className={textInput}
              />
            </Field>
            <Field label="Operator">
              <select
                value={c.conditionOp || "=="}
                onChange={(e) =>
                  onChangeConfig({
                    conditionOp: e.target.value as typeof c.conditionOp,
                  })
                }
                className={textInput}
              >
                {["==", "!=", ">", "<", ">=", "<="].map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Value">
              <input
                value={c.conditionValue || ""}
                onChange={(e) =>
                  onChangeConfig({ conditionValue: e.target.value })
                }
                className={textInput}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="On true → go to step">
              <StepSelect
                value={c.onTrueStepId}
                options={stepOptions}
                onChange={(v) => onChangeConfig({ onTrueStepId: v })}
              />
            </Field>
            <Field label="On false → go to step">
              <StepSelect
                value={c.onFalseStepId}
                options={stepOptions}
                onChange={(v) => onChangeConfig({ onFalseStepId: v })}
              />
            </Field>
          </div>
        </div>
      );
    case "delay":
      return (
        <Field label="Delay (seconds)">
          <input
            type="number"
            min={0}
            value={c.delaySeconds ?? 0}
            onChange={(e) =>
              onChangeConfig({ delaySeconds: Number(e.target.value) || 0 })
            }
            className={textInput}
          />
        </Field>
      );
    case "http_request":
      return (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Method">
              <select
                value={c.method || "GET"}
                onChange={(e) =>
                  onChangeConfig({
                    method: e.target.value as "GET" | "POST",
                  })
                }
                className={textInput}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="URL">
                <input
                  value={c.url || ""}
                  onChange={(e) => onChangeConfig({ url: e.target.value })}
                  className={textInput}
                  placeholder="https://example.com/webhook"
                />
              </Field>
            </div>
          </div>
          {c.method === "POST" ? (
            <Field label="Body (JSON)">
              <textarea
                rows={3}
                value={c.body || ""}
                onChange={(e) => onChangeConfig({ body: e.target.value })}
                className={textInput}
              />
            </Field>
          ) : null}
        </div>
      );
    default:
      return null;
  }
}

function StepSelect({
  value,
  options,
  onChange,
}: {
  value?: string;
  options: StepOption[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={textInput}
    >
      <option value="">(next in order)</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {formatStepOption(o)}
        </option>
      ))}
    </select>
  );
}

type StepOption = {
  id: string;
  name: string;
  type: StepType;
  order: number;
  index: number;
};

function formatStepOption(option: StepOption) {
  const label = option.name.trim() || "Untitled step";
  const shortId = option.id.slice(-6);
  return `Step ${option.index + 1}: ${label} · ${
    STEP_TYPE_META[option.type].label
  } · ${shortId}`;
}
