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

  const { workflowId } = request.data;
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

  for (const doc of snap.docs) {
    const workflow = { id: doc.id, ...doc.data() } as Workflow;
    const cron = workflow.trigger.config.cron;
    if (!cron) continue;

    if (shouldRunNow(cron, now)) {
      try {
        await runWorkflow(workflow, "schedule");
      } catch (err) {
        console.error(`scheduled run failed for ${workflow.id}:`, err);
      }
    }
  }
});

function shouldRunNow(cron: string, now: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return false;

  const [minStr, hourStr, dayStr, monthStr, dowStr] = parts;

  const minute = now.getMinutes();
  const hour = now.getHours();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const dow = now.getDay();

  if (!matchField(minStr, minute)) return false;
  if (!matchField(hourStr, hour)) return false;
  if (!matchField(dayStr, day)) return false;
  if (!matchField(monthStr, month)) return false;
  if (!matchField(dowStr, dow)) return false;

  return true;
}

function matchField(field: string, value: number): boolean {
  if (field === "*") return true;

  if (field.includes("/")) {
    const [, stepStr] = field.split("/");
    const step = parseInt(stepStr, 10);
    return value % step === 0;
  }

  if (field.includes(",")) {
    return field.split(",").some((v) => parseInt(v, 10) === value);
  }

  if (field.includes("-")) {
    const [lo, hi] = field.split("-").map((v) => parseInt(v, 10));
    return value >= lo && value <= hi;
  }

  return parseInt(field, 10) === value;
}
