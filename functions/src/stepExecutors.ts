import * as admin from "firebase-admin";
import { WorkflowStep } from "./types";

export interface StepResult {
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
  nextStepId?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSendNotification(step: WorkflowStep): Promise<StepResult> {
  const message = step.config.message || "no message set";
  console.log(`[notification] ${message}`);
  return {
    success: true,
    output: { message, sentAt: Date.now() },
  };
}

async function runUpdateRecord(step: WorkflowStep): Promise<StepResult> {
  const { collection, field, value } = step.config;
  if (!collection || !field) {
    return {
      success: false,
      output: {},
      error: "missing collection or field in config",
    };
  }

  const db = admin.firestore();
  const ref = db.collection(collection).doc();
  await ref.set({
    [field]: value ?? null,
    updatedByWorkflow: true,
    updatedAt: Date.now(),
  });

  return {
    success: true,
    output: { docId: ref.id, collection, field, value },
  };
}

async function runLogEvent(step: WorkflowStep): Promise<StepResult> {
  const message = step.config.message || "event logged";
  console.log(`[log_event] ${message}`);
  return {
    success: true,
    output: { logged: message, at: Date.now() },
  };
}

function compare(op: string, actual: unknown, expected: unknown): boolean {
  switch (op) {
    case "==":
      return String(actual) === String(expected);
    case "!=":
      return String(actual) !== String(expected);
    case ">":
      return Number(actual) > Number(expected);
    case "<":
      return Number(actual) < Number(expected);
    case ">=":
      return Number(actual) >= Number(expected);
    case "<=":
      return Number(actual) <= Number(expected);
    default:
      return false;
  }
}

async function runCondition(
  step: WorkflowStep,
  context: Record<string, unknown>
): Promise<StepResult> {
  const { conditionField, conditionOp, conditionValue, onTrueStepId, onFalseStepId } =
    step.config;

  if (!conditionField || !conditionOp || conditionValue === undefined) {
    return {
      success: false,
      output: {},
      error: "incomplete condition config",
    };
  }

  const actual = context[conditionField];
  const passed = compare(conditionOp, actual, conditionValue);

  return {
    success: true,
    output: {
      conditionField,
      conditionOp,
      expected: conditionValue,
      actual,
      passed,
    },
    nextStepId: passed ? onTrueStepId : onFalseStepId,
  };
}

async function runDelay(step: WorkflowStep): Promise<StepResult> {
  const seconds = Number(step.config.delaySeconds) || 0;
  const capped = Math.max(0, Math.min(seconds, 30));
  await sleep(capped * 1000);
  return {
    success: true,
    output: { delayedSeconds: capped },
  };
}

async function runHttpRequest(step: WorkflowStep): Promise<StepResult> {
  const { url, method, body } = step.config;
  if (!url) {
    return { success: false, output: {}, error: "url is required" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: method || "GET",
      headers:
        method === "POST" ? { "content-type": "application/json" } : undefined,
      body: method === "POST" ? body || "{}" : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    const out: Record<string, unknown> = {
      status: res.status,
      ok: res.ok,
      body: text.slice(0, 2048),
    };
    return {
      success: res.ok,
      output: out,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: {}, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

export async function executeStep(
  step: WorkflowStep,
  context: Record<string, unknown>
): Promise<StepResult> {
  switch (step.type) {
    case "send_notification":
      return runSendNotification(step);
    case "update_record":
      return runUpdateRecord(step);
    case "log_event":
      return runLogEvent(step);
    case "condition":
      return runCondition(step, context);
    case "delay":
      return runDelay(step);
    case "http_request":
      return runHttpRequest(step);
    default:
      return {
        success: false,
        output: {},
        error: `unknown step type: ${step.type}`,
      };
  }
}
