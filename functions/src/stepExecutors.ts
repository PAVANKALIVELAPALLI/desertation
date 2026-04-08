import * as admin from "firebase-admin";
import { WorkflowStep } from "./types";

export interface StepResult {
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
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
  await ref.set({ [field]: value, updatedByWorkflow: true, updatedAt: Date.now() });

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

async function runCondition(
  step: WorkflowStep,
  context: Record<string, unknown>
): Promise<StepResult> {
  const { conditionField, conditionOp, conditionValue } = step.config;
  if (!conditionField || !conditionOp || conditionValue === undefined) {
    return {
      success: false,
      output: {},
      error: "incomplete condition config",
    };
  }

  const actual = context[conditionField];
  const expected = conditionValue;
  let passed = false;

  switch (conditionOp) {
    case "==":
      passed = String(actual) === String(expected);
      break;
    case "!=":
      passed = String(actual) !== String(expected);
      break;
    case ">":
      passed = Number(actual) > Number(expected);
      break;
    case "<":
      passed = Number(actual) < Number(expected);
      break;
  }

  return {
    success: passed,
    output: { conditionField, conditionOp, conditionValue: expected, actual, passed },
    error: passed ? undefined : `condition failed: ${conditionField} ${conditionOp} ${expected}`,
  };
}

async function runDelay(step: WorkflowStep): Promise<StepResult> {
  const seconds = Number(step.config.delaySeconds) || 1;
  const capped = Math.min(seconds, 30);
  await sleep(capped * 1000);
  return {
    success: true,
    output: { delayedSeconds: capped },
  };
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
    default:
      return { success: false, output: {}, error: `unknown step type: ${step.type}` };
  }
}
