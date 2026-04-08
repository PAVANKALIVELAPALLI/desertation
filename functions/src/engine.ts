import * as admin from "firebase-admin";
import { Workflow, TriggerType, ExecutionLog } from "./types";
import { executeStep, StepResult } from "./stepExecutors";

const db = admin.firestore();

function sortStepsByOrder(workflow: Workflow): Workflow {
  const sorted = [...workflow.steps].sort((a, b) => a.order - b.order);
  return { ...workflow, steps: sorted };
}

async function writeLog(log: Omit<ExecutionLog, "id">): Promise<void> {
  await db.collection("executionLogs").add(log);
}

export async function runWorkflow(
  workflow: Workflow,
  triggeredBy: TriggerType
): Promise<void> {
  const ordered = sortStepsByOrder(workflow);

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
    stepsTotal: ordered.steps.length,
  });

  const executionId = executionRef.id;
  const context: Record<string, unknown> = {};
  let completed = 0;

  for (const step of ordered.steps) {
    const stepStart = Date.now();
    let result: StepResult;

    try {
      result = await executeStep(step, context);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      result = { success: false, output: {}, error: errMsg };
    }

    const duration = Date.now() - stepStart;

    await writeLog({
      executionId,
      workflowId: workflow.id!,
      stepId: step.id,
      stepName: step.name,
      level: result.success ? "info" : "error",
      message: result.success
        ? `step "${step.name}" completed`
        : `step "${step.name}" failed: ${result.error}`,
      input: step.config as Record<string, unknown>,
      output: result.output,
      error: result.error || null,
      timestamp: Date.now(),
      durationMs: duration,
    });

    if (!result.success) {
      await executionRef.update({
        status: "failed",
        completedAt: Date.now(),
        error: result.error || "step failed",
        stepsCompleted: completed,
      });
      return;
    }

    completed++;
    Object.assign(context, result.output);

    await executionRef.update({ stepsCompleted: completed });
  }

  await executionRef.update({
    status: "completed",
    completedAt: Date.now(),
    stepsCompleted: completed,
  });
}
