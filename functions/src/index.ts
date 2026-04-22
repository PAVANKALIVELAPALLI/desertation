import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { Workflow } from "./types";
import { runWorkflow } from "./engine";

admin.initializeApp();
const db = admin.firestore();

export const executeWorkflow = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "you need to be logged in");
  }

  const { workflowId } = request.data as { workflowId?: string };
  if (!workflowId) {
    throw new HttpsError("invalid-argument", "workflowId is required");
  }

  const snap = await db.collection("workflows").doc(workflowId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "workflow not found");
  }

  const workflow = { id: snap.id, ...snap.data() } as Workflow;

  if (workflow.userId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "not your workflow");
  }

  if (workflow.status === "draft") {
    throw new HttpsError("failed-precondition", "workflow is still a draft");
  }

  await runWorkflow(workflow, "manual");

  return { ok: true };
});

export const scheduledRunner = onSchedule("every 1 minutes", async () => {
  const now = new Date();
  const snap = await db
    .collection("workflows")
    .where("status", "==", "active")
    .where("trigger.type", "==", "schedule")
    .get();

  const tasks: Promise<void>[] = [];
  for (const doc of snap.docs) {
    const workflow = { id: doc.id, ...doc.data() } as Workflow;
    const cron = workflow.trigger.config.cron;
    if (!cron) continue;
    if (!shouldRunNow(cron, now)) continue;

    tasks.push(
      runWorkflow(workflow, "schedule").catch((err) => {
        console.error(`scheduled run failed for ${workflow.id}:`, err);
      })
    );
  }

  await Promise.all(tasks);
});

function shouldRunNow(cron: string, now: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minStr, hourStr, dayStr, monthStr, dowStr] = parts;

  const minute = now.getMinutes();
  const hour = now.getHours();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const dow = now.getDay();

  if (!matchField(minStr, minute, 0, 59)) return false;
  if (!matchField(hourStr, hour, 0, 23)) return false;
  if (!matchField(dayStr, day, 1, 31)) return false;
  if (!matchField(monthStr, month, 1, 12)) return false;
  if (!matchField(dowStr, dow, 0, 6)) return false;

  return true;
}

function matchField(field: string, value: number, lo: number, hi: number): boolean {
  if (field === "*") return true;

  if (field.includes("/")) {
    const [range, stepStr] = field.split("/");
    const step = parseInt(stepStr, 10);
    if (!Number.isFinite(step) || step <= 0) return false;
    const [rLo, rHi] =
      range === "*"
        ? [lo, hi]
        : range.includes("-")
          ? range.split("-").map((v) => parseInt(v, 10))
          : [parseInt(range, 10), hi];
    if (value < rLo || value > rHi) return false;
    return (value - rLo) % step === 0;
  }

  if (field.includes(",")) {
    return field.split(",").some((v) => matchField(v, value, lo, hi));
  }

  if (field.includes("-")) {
    const [a, b] = field.split("-").map((v) => parseInt(v, 10));
    return value >= a && value <= b;
  }

  return parseInt(field, 10) === value;
}
