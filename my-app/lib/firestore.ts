import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { getFirebaseAuth, getFirestore } from "./firebase";
import type {
  Execution,
  ExecutionLog,
  Workflow,
  WorkflowStep,
} from "@/types/workflow";

type StepResult = {
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
  nextStepId?: string;
};

export async function createWorkflow(data: Omit<Workflow, "id">) {
  const ref = await addDoc(collection(getFirestore(), "workflows"), data);
  return ref.id;
}

export async function createWorkflowsBatch(
  items: Omit<Workflow, "id">[]
): Promise<void> {
  if (items.length === 0) return;
  const db = getFirestore();
  const batch = writeBatch(db);
  const col = collection(db, "workflows");
  for (const item of items) {
    batch.set(doc(col), item);
  }
  await batch.commit();
}

export async function updateWorkflow(id: string, data: Partial<Workflow>) {
  await updateDoc(doc(getFirestore(), "workflows", id), {
    ...data,
    updatedAt: Date.now(),
  });
}

export async function deleteWorkflow(id: string) {
  await deleteDoc(doc(getFirestore(), "workflows", id));
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const snap = await getDoc(doc(getFirestore(), "workflows", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Workflow;
}

export async function getUserWorkflows(userId: string): Promise<Workflow[]> {
  const q = query(
    collection(getFirestore(), "workflows"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workflow);
}

export async function createExecution(data: Omit<Execution, "id">) {
  const ref = await addDoc(collection(getFirestore(), "executions"), data);
  return ref.id;
}

export async function updateExecution(id: string, data: Partial<Execution>) {
  await updateDoc(doc(getFirestore(), "executions", id), data);
}

export async function getExecution(id: string): Promise<Execution | null> {
  const snap = await getDoc(doc(getFirestore(), "executions", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Execution;
}

export async function getWorkflowExecutions(
  workflowId: string,
  userId: string,
  max = 50
): Promise<Execution[]> {
  const q = query(
    collection(getFirestore(), "executions"),
    where("workflowId", "==", workflowId),
    where("userId", "==", userId),
    orderBy("startedAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Execution);
}

export async function getUserExecutions(
  userId: string,
  max = 100
): Promise<Execution[]> {
  const q = query(
    collection(getFirestore(), "executions"),
    where("userId", "==", userId),
    orderBy("startedAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Execution);
}

export async function addExecutionLog(data: Omit<ExecutionLog, "id">) {
  const ref = await addDoc(collection(getFirestore(), "executionLogs"), data);
  return ref.id;
}

export async function getExecutionLogs(
  executionId: string
): Promise<ExecutionLog[]> {
  const q = query(
    collection(getFirestore(), "executionLogs"),
    where("executionId", "==", executionId),
    orderBy("timestamp", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExecutionLog);
}

export async function runWorkflowNow(workflowId: string): Promise<void> {
  const user = getFirebaseAuth().currentUser;
  if (!user) throw new Error("you need to be logged in");

  const workflow = await getWorkflow(workflowId);
  if (!workflow || !workflow.id) throw new Error("workflow not found");
  if (workflow.userId !== user.uid) throw new Error("not your workflow");
  if (workflow.status === "draft") {
    throw new Error("workflow is still a draft");
  }

  const db = getFirestore();
  const steps = orderedSteps(workflow);
  const executionRef = await addDoc(collection(db, "executions"), {
    workflowId: workflow.id,
    workflowName: workflow.name,
    userId: user.uid,
    status: "running",
    triggeredBy: "manual",
    startedAt: Date.now(),
    completedAt: null,
    error: null,
    stepsCompleted: 0,
    stepsTotal: steps.length,
  } satisfies Omit<Execution, "id">);

  const context: Record<string, unknown> = {};
  let completed = 0;
  let firstError: string | null = null;
  let index = 0;
  const seen = new Set<string>();
  const skippedByBranch = new Set<string>();

  while (index < steps.length) {
    const step = steps[index];

    if (skippedByBranch.has(step.id)) {
      index++;
      continue;
    }

    if (seen.has(step.id)) {
      await writeExecutionLog(db, {
        executionId: executionRef.id,
        workflowId: workflow.id,
        stepId: step.id,
        stepName: step.name,
        level: "warn",
        message: `step "${step.name}" already ran, skipping it`,
        input: null,
        output: null,
        error: null,
        timestamp: Date.now(),
        durationMs: null,
      });
      index++;
      continue;
    }
    seen.add(step.id);

    const startedAt = Date.now();
    const result = await runStep(db, workflow, step, context);
    const durationMs = Date.now() - startedAt;
    const level = result.success ? "info" : step.continueOnError ? "warn" : "error";

    await writeExecutionLog(db, {
      executionId: executionRef.id,
      workflowId: workflow.id,
      stepId: step.id,
      stepName: step.name,
      level,
      message: result.success
        ? `step "${step.name}" completed`
        : `step "${step.name}" failed: ${result.error}`,
      input: { ...step.config },
      output: result.output,
      error: result.error || null,
      timestamp: Date.now(),
      durationMs,
    });

    if (!result.success && !step.continueOnError) {
      await updateDoc(executionRef, {
        status: "failed",
        completedAt: Date.now(),
        error: result.error || "step failed",
        stepsCompleted: completed,
      } satisfies Partial<Execution>);
      await bumpWorkflowStats(workflow.id);
      return;
    }

    if (result.success) completed++;
    else if (!firstError) firstError = result.error || "step failed";

    Object.assign(context, result.output);
    await updateDoc(executionRef, { stepsCompleted: completed });

    if (step.type === "condition") {
      const onTrue = step.config.onTrueStepId;
      const onFalse = step.config.onFalseStepId;
      if (onTrue && onTrue !== result.nextStepId) skippedByBranch.add(onTrue);
      if (onFalse && onFalse !== result.nextStepId) skippedByBranch.add(onFalse);
    }

    if (result.nextStepId) {
      const nextIndex = steps.findIndex((s) => s.id === result.nextStepId);
      if (nextIndex >= 0) {
        index = nextIndex;
        continue;
      }
      await writeExecutionLog(db, {
        executionId: executionRef.id,
        workflowId: workflow.id,
        stepId: step.id,
        stepName: step.name,
        level: "warn",
        message: `branch target "${result.nextStepId}" was not found`,
        input: null,
        output: null,
        error: null,
        timestamp: Date.now(),
        durationMs: null,
      });
    }

    index++;
  }

  await updateDoc(executionRef, {
    status: firstError ? "failed" : "completed",
    completedAt: Date.now(),
    error: firstError,
    stepsCompleted: completed,
  } satisfies Partial<Execution>);
  await bumpWorkflowStats(workflow.id);
}

function orderedSteps(workflow: Workflow): WorkflowStep[] {
  return [...workflow.steps].sort((a, b) => {
    const priority = (b.priority ?? 0) - (a.priority ?? 0);
    return priority || a.order - b.order;
  });
}

async function writeExecutionLog(
  db: Firestore,
  log: Omit<ExecutionLog, "id">,
) {
  await addDoc(collection(db, "executionLogs"), log);
}

async function bumpWorkflowStats(workflowId: string) {
  await updateDoc(doc(getFirestore(), "workflows", workflowId), {
    lastRunAt: Date.now(),
    runCount: increment(1),
    updatedAt: Date.now(),
  });
}

async function runStep(
  db: Firestore,
  workflow: Workflow,
  step: WorkflowStep,
  context: Record<string, unknown>,
): Promise<StepResult> {
  const maxRetries = Math.max(0, Math.min(5, step.retries ?? 0));
  let last: StepResult = {
    success: false,
    output: {},
    error: "not executed",
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      last = await runStepOnce(db, workflow, step, context);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      last = { success: false, output: {}, error: msg };
    }

    if (last.success || step.type === "condition") return last;
    if (attempt < maxRetries) {
      await sleep(Math.min(1000 * 2 ** attempt, 5000));
    }
  }

  return last;
}

async function runStepOnce(
  db: Firestore,
  workflow: Workflow,
  step: WorkflowStep,
  context: Record<string, unknown>,
): Promise<StepResult> {
  const config = step.config;

  if (step.type === "send_notification") {
    const rawMessage = config.message || "no message set";
    const message = resolveTemplate(rawMessage, context);
    const channel = config.notificationChannel || (config.emailTo ? "email" : "app");

    if (channel === "email") {
      if (!config.emailTo) {
        return {
          success: false,
          output: {},
          error: "email recipient is required",
        };
      }
      const to = resolveTemplate(config.emailTo, context);
      const subject = resolveTemplate(
        config.emailSubject || workflow.name,
        context,
      );
      try {
        const { getFunctions, httpsCallable } = await import("firebase/functions");
        const { getFirebaseApp } = await import("./firebase");
        const fns = getFunctions(getFirebaseApp(), "us-central1");
        const callable = httpsCallable(fns, "sendEmail");
        const res = await callable({ to, subject, body: message });
        const data = (res.data ?? {}) as {
          ok?: boolean;
          messageId?: string;
          accepted?: string[];
        };
        return {
          success: true,
          output: {
            channel,
            to,
            subject,
            message,
            status: "sent",
            messageId: data.messageId,
            accepted: data.accepted,
            sentAt: Date.now(),
          },
        };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          output: {
            channel,
            to,
            subject,
            message,
            status: "failed",
            mailto: buildMailto(to, subject, message),
          },
          error: errMsg,
        };
      }
    }

    return {
      success: true,
      output: { channel, message, sentAt: Date.now() },
    };
  }

  if (step.type === "log_event") {
    const rawMessage = config.message || "event logged";
    const message = resolveTemplate(rawMessage, context);
    return { success: true, output: { logged: message, at: Date.now() } };
  }

  if (step.type === "update_record") {
    if (!config.collection || !config.field) {
      return {
        success: false,
        output: {},
        error: "missing collection or field in config",
      };
    }
    try {
      const { getFunctions, httpsCallable } = await import("firebase/functions");
      const { getFirebaseApp } = await import("./firebase");
      const fns = getFunctions(getFirebaseApp(), "us-central1");
      const callable = httpsCallable(fns, "writeRecord");
      const res = await callable({
        collection: config.collection,
        field: config.field,
        value: config.value ?? null,
        workflowId: workflow.id,
      });
      const data = (res.data ?? {}) as {
        ok?: boolean;
        docId?: string;
        collection?: string;
        field?: string;
        value?: unknown;
      };
      return {
        success: true,
        output: {
          docId: data.docId,
          collection: data.collection ?? config.collection,
          field: data.field ?? config.field,
          value: data.value ?? config.value ?? null,
        },
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        output: {
          collection: config.collection,
          field: config.field,
          value: config.value ?? null,
        },
        error: errMsg,
      };
    }
  }

  if (step.type === "condition") {
    if (
      !config.conditionField ||
      !config.conditionOp ||
      config.conditionValue === undefined
    ) {
      return {
        success: false,
        output: {},
        error: "incomplete condition config",
      };
    }
    const actual = context[config.conditionField];
    const passed = compare(
      config.conditionOp,
      actual,
      config.conditionValue,
    );
    return {
      success: true,
      output: {
        conditionField: config.conditionField,
        conditionOp: config.conditionOp,
        expected: config.conditionValue,
        actual,
        passed,
      },
      nextStepId: passed ? config.onTrueStepId : config.onFalseStepId,
    };
  }

  if (step.type === "delay") {
    const seconds = Math.max(0, Math.min(Number(config.delaySeconds) || 0, 30));
    await sleep(seconds * 1000);
    return { success: true, output: { delayedSeconds: seconds } };
  }

  if (step.type === "http_request") {
    if (!config.url) return { success: false, output: {}, error: "url is required" };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(config.url, {
        method: config.method || "GET",
        headers:
          config.method === "POST"
            ? { "content-type": "application/json" }
            : undefined,
        body: config.method === "POST" ? config.body || "{}" : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      return {
        success: res.ok,
        output: {
          status: res.status,
          ok: res.ok,
          body: parsed ?? text.slice(0, 2048),
          bodyText: text.slice(0, 2048),
        },
        error: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    success: false,
    output: {},
    error: `unknown step type: ${step.type}`,
  };
}

function compare(op: string, actual: unknown, expected: unknown): boolean {
  if (op === "==") return String(actual) === String(expected);
  if (op === "!=") return String(actual) !== String(expected);
  if (op === ">") return Number(actual) > Number(expected);
  if (op === "<") return Number(actual) < Number(expected);
  if (op === ">=") return Number(actual) >= Number(expected);
  if (op === "<=") return Number(actual) <= Number(expected);
  return false;
}

function buildMailto(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

function resolveTemplate(
  template: string | undefined,
  context: Record<string, unknown>,
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (match, path: string) => {
    const segments = path.split(".");
    let value: unknown = context;
    for (const seg of segments) {
      if (value == null || typeof value !== "object") return match;
      value = (value as Record<string, unknown>)[seg];
    }
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
