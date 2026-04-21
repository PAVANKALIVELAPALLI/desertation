import * as admin from "firebase-admin";
import { Workflow, TriggerType, ExecutionLog, WorkflowStep } from "./types";
import { executeStep, StepResult } from "./stepExecutors";

const db = admin.firestore();

function orderedSteps(workflow: Workflow): WorkflowStep[] {
  return [...workflow.steps].sort((a, b) => {
    const pa = b.priority ?? 0;
    const pb = a.priority ?? 0;
    if (pa !== pb) return pa - pb;
    return a.order - b.order;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeLog(log: Omit<ExecutionLog, "id">): Promise<void> {
  await db.collection("executionLogs").add(log);
}

async function runStepWithRetries(
  step: WorkflowStep,
  context: Record<string, unknown>,
): Promise<StepResult> {
  const maxRetries = Math.max(0, Math.min(5, step.retries ?? 0));
  let lastResult: StepResult = {
    success: false,
    output: {},
    error: "not executed",
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      lastResult = await executeStep(step, context);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      lastResult = { success: false, output: {}, error: msg };
    }

    if (lastResult.success || step.type === "condition") return lastResult;

    if (attempt < maxRetries) {
      const backoff = Math.min(1000 * 2 ** attempt, 5000);
      await sleep(backoff);
    }
  }

  return lastResult;
}

export async function runWorkflow(
  workflow: Workflow,
  triggeredBy: TriggerType,
): Promise<void> {
  const ordered = orderedSteps(workflow);

  const executionRef = await db.collection("executions").add({
    workflowId: workflow.id,
    workflowName: workflow.name,
    userId: workflow.userId,
    status: "running",
    triggeredBy,
    startedAt: Date.now(),
    completedAt: null,
    error: null,
    stepsCompleted: 0,
    stepsTotal: ordered.length,
  });

  const executionId = executionRef.id;
  const context: Record<string, unknown> = {};
  let completed = 0;
  let firstError: string | null = null;

  let idx = 0;
  const seen = new Set<string>();

  while (idx < ordered.length) {
    const step = ordered[idx];

    if (seen.has(step.id)) {
      await writeLog({
        executionId,
        workflowId: workflow.id!,
        stepId: step.id,
        stepName: step.name,
        level: "warn",
        message: `step "${step.name}" already visited - skipping to prevent loop`,
        input: null,
        output: null,
        error: null,
        timestamp: Date.now(),
        durationMs: null,
      });
      idx++;
      continue;
    }
    seen.add(step.id);

    const stepStart = Date.now();
    const result = await runStepWithRetries(step, context);
    const durationMs = Date.now() - stepStart;

    const logLevel: ExecutionLog["level"] = result.success
      ? "info"
      : step.continueOnError
        ? "warn"
        : "error";

    await writeLog({
      executionId,
      workflowId: workflow.id!,
      stepId: step.id,
      stepName: step.name,
      level: logLevel,
      message: result.success
        ? `step "${step.name}" completed`
        : `step "${step.name}" failed: ${result.error}`,
      input: step.config as Record<string, unknown>,
      output: result.output,
      error: result.error || null,
      timestamp: Date.now(),
      durationMs,
    });

    if (!result.success && !step.continueOnError) {
      await executionRef.update({
        status: "failed",
        completedAt: Date.now(),
        error: result.error || "step failed",
        stepsCompleted: completed,
      });
      await bumpWorkflowRun(workflow.id!);
      return;
    }

    if (result.success) completed++;
    else if (!firstError) firstError = result.error || "step failed";

    Object.assign(context, result.output);
    await executionRef.update({ stepsCompleted: completed });

    if (result.nextStepId) {
      const nextIdx = ordered.findIndex((s) => s.id === result.nextStepId);
      if (nextIdx >= 0) {
        idx = nextIdx;
        continue;
      }
      await writeLog({
        executionId,
        workflowId: workflow.id!,
        stepId: step.id,
        stepName: step.name,
        level: "warn",
        message: `branch target "${result.nextStepId}" not found, falling through`,
        input: null,
        output: null,
        error: null,
        timestamp: Date.now(),
        durationMs: null,
      });
    }

    idx++;
  }

  await executionRef.update({
    status: firstError ? "failed" : "completed",
    completedAt: Date.now(),
    error: firstError,
    stepsCompleted: completed,
  });
  await bumpWorkflowRun(workflow.id!);
}

async function bumpWorkflowRun(workflowId: string) {
  try {
    await db
      .collection("workflows")
      .doc(workflowId)
      .update({
        lastRunAt: Date.now(),
        runCount: admin.firestore.FieldValue.increment(1),
      });
  } catch (err) {
    console.error("failed to bump workflow stats:", err);
  }
}
