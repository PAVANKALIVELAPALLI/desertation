import * as admin from "firebase-admin";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as nodemailer from "nodemailer";
import { Workflow, WorkflowStep } from "./types";
import { runWorkflow } from "./engine";

admin.initializeApp();
const db = admin.firestore();

const gmailUser = defineSecret("GMAIL_USER");
const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

let _mailer: nodemailer.Transporter | null = null;
function getMailer(): nodemailer.Transporter | null {
  if (_mailer) return _mailer;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  _mailer = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  return _mailer;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const sendEmail = onCall(
  {
    region: "us-central1",
    secrets: [gmailUser, gmailAppPassword],
    cors: [
      /^http:\/\/localhost:\d+$/,
      "https://desertation-ccace.web.app",
      "https://desertation-ccace.firebaseapp.com",
    ],
    invoker: "public",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "you need to be logged in");
    }
    const data = (request.data ?? {}) as {
      to?: string;
      subject?: string;
      body?: string;
    };
    const to = (data.to || "").trim();
    const subject = (data.subject || "Workflow notification").trim();
    const body = data.body || "";
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      throw new HttpsError("invalid-argument", "valid 'to' email is required");
    }
    const mailer = getMailer();
    if (!mailer) {
      throw new HttpsError(
        "failed-precondition",
        "email is not configured on the server"
      );
    }
    const fromAddress = process.env.GMAIL_USER || "noreply@desertation-ccace.web.app";
    const fromHeader = `Workflow App <${fromAddress}>`;
    try {
      const info = await mailer.sendMail({
        from: fromHeader,
        to,
        subject,
        text: body,
        html: `<p>${escapeHtml(body)}</p>`,
      });
      return {
        ok: true,
        messageId: info.messageId,
        accepted: info.accepted,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpsError("internal", `email failed: ${message}`);
    }
  }
);

export const executeWorkflow = onCall(
  {
    region: "us-central1",
    secrets: [gmailUser, gmailAppPassword],
    cors: [
      /^http:\/\/localhost:\d+$/,
      "https://desertation-ccace.web.app",
      "https://desertation-ccace.firebaseapp.com",
    ],
    invoker: "public",
  },
  async (request) => {
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

// Workflow `update_record` step: writes a field/value pair into the user-named
// collection. Server-side because Firestore rules block writes from the client
// to arbitrary collection names. Auth-gated, rejects system collections.
const SYSTEM_COLLECTIONS = new Set([
  "workflows",
  "executions",
  "executionLogs",
  "users",
  "system",
]);

export const writeRecord = onCall(
  {
    region: "us-central1",
    cors: [
      /^http:\/\/localhost:\d+$/,
      "https://desertation-ccace.web.app",
      "https://desertation-ccace.firebaseapp.com",
    ],
    invoker: "public",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "you need to be logged in");
    }
    const data = (request.data ?? {}) as {
      collection?: string;
      field?: string;
      value?: unknown;
      workflowId?: string;
    };
    const target = (data.collection || "").trim();
    const field = (data.field || "").trim();
    if (!target || !field) {
      throw new HttpsError(
        "invalid-argument",
        "collection and field are required"
      );
    }
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,62}$/.test(target)) {
      throw new HttpsError(
        "invalid-argument",
        "collection name must start with a letter and contain only letters, numbers, underscores, or dashes (max 63 chars)"
      );
    }
    if (SYSTEM_COLLECTIONS.has(target)) {
      throw new HttpsError(
        "permission-denied",
        `cannot write to reserved system collection "${target}"`
      );
    }
    const ref = db.collection(target).doc();
    await ref.set({
      [field]: data.value ?? null,
      userId: request.auth.uid,
      updatedByWorkflow: true,
      workflowId: data.workflowId ?? null,
      createdAt: Date.now(),
    });
    return {
      ok: true,
      docId: ref.id,
      collection: target,
      field,
      value: data.value ?? null,
    };
  }
);

// One-shot: pauses all the caller's active scheduled workflows.
// Optionally keep specific workflow IDs active via `keepIds` param.
// Returns { paused: [{id, name, cron}], kept: [{id, name}] }.
export const pauseAllScheduled = onCall(
  {
    region: "us-central1",
    cors: [
      /^http:\/\/localhost:\d+$/,
      "https://desertation-ccace.web.app",
      "https://desertation-ccace.firebaseapp.com",
    ],
    invoker: "public",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "you need to be logged in");
    }
    const uid = request.auth.uid;
    const data = (request.data ?? {}) as { keepIds?: string[] };
    const keep = new Set(data.keepIds ?? []);

    const snap = await db
      .collection("workflows")
      .where("userId", "==", uid)
      .where("status", "==", "active")
      .where("trigger.type", "==", "schedule")
      .get();

    const paused: { id: string; name: string; cron: string | null }[] = [];
    const kept: { id: string; name: string }[] = [];
    const batch = db.batch();
    for (const doc of snap.docs) {
      const wf = doc.data() as Workflow;
      if (keep.has(doc.id)) {
        kept.push({ id: doc.id, name: wf.name });
        continue;
      }
      batch.update(doc.ref, { status: "inactive", updatedAt: Date.now() });
      paused.push({
        id: doc.id,
        name: wf.name,
        cron: wf.trigger?.config?.cron ?? null,
      });
    }
    if (paused.length > 0) await batch.commit();
    return { paused, kept };
  }
);

export const scheduledRunner = onSchedule(
  {
    schedule: "every 1 minutes",
    secrets: [gmailUser, gmailAppPassword],
  },
  async () => {
  try {
    const cfg = await db.doc("system/scheduler").get();
    if (cfg.exists && cfg.data()?.enabled === false) {
      console.log("[scheduledRunner] kill-switch is set to false — skipping");
      return;
    }
  } catch (err) {
    console.warn("[scheduledRunner] kill-switch read error, continuing:", err);
  }

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
  }
);

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

// Debug endpoint: lists every active scheduled workflow.
// Open in a browser to see id, name, cron, and email step config.
// Optional ?action=pauseAll&secret=XXX disables all of them.
export const debugSchedules = onRequest(
  {
    region: "us-central1",
    cors: true,
  },
  async (req, res) => {
    const snap = await db
      .collection("workflows")
      .where("status", "==", "active")
      .where("trigger.type", "==", "schedule")
      .get();

    const rows = snap.docs.map((d) => {
      const data = d.data() as Workflow;
      const steps = (data.steps || []).map((s: WorkflowStep) => ({
        name: s.name,
        type: s.type,
        emailTo: s.config?.emailTo,
        emailSubject: s.config?.emailSubject,
        message: s.config?.message,
        cron: data.trigger?.config?.cron,
      }));
      return {
        id: d.id,
        name: data.name,
        userId: data.userId,
        cron: data.trigger?.config?.cron,
        steps,
      };
    });

    if (req.query.action === "pauseAll" && req.query.secret === "knockknock") {
      const batch = db.batch();
      snap.docs.forEach((d) =>
        batch.update(d.ref, { status: "inactive", updatedAt: Date.now() })
      );
      if (snap.size > 0) await batch.commit();
      res.json({ pausedCount: snap.size, paused: rows });
      return;
    }

    if (req.query.action === "pauseId" && typeof req.query.id === "string") {
      const id = req.query.id;
      const target = snap.docs.find((d) => d.id === id);
      if (!target) {
        res.status(404).json({ error: `workflow ${id} not active+scheduled` });
        return;
      }
      await target.ref.update({ status: "inactive", updatedAt: Date.now() });
      res.json({ paused: id });
      return;
    }

    res.json({ count: snap.size, workflows: rows });
  }
);

// Fires every workflow with trigger.type=form_submit and matching formId
// whenever a doc lands in /formSubmissions.
// The submission doc must include { formId, userId, ...payload }.
// Payload fields become available in step context so condition steps can
// branch on them.
export const onFormSubmission = onDocumentCreated(
  {
    region: "us-central1",
    document: "formSubmissions/{submissionId}",
    secrets: [gmailUser, gmailAppPassword],
  },
  async (event) => {
    const submission = event.data?.data();
    if (!submission) return;

    const formId = submission.formId as string | undefined;
    const userId = submission.userId as string | undefined;
    if (!formId || !userId) {
      console.warn(
        `[onFormSubmission] missing formId or userId on submission ${event.params.submissionId}`
      );
      return;
    }

    const snap = await db
      .collection("workflows")
      .where("userId", "==", userId)
      .where("status", "==", "active")
      .where("trigger.type", "==", "form_submit")
      .where("trigger.config.formId", "==", formId)
      .get();

    if (snap.empty) {
      console.log(
        `[onFormSubmission] no active form_submit workflows for formId="${formId}" user=${userId}`
      );
      return;
    }

    const tasks: Promise<void>[] = [];
    for (const doc of snap.docs) {
      const wf = { id: doc.id, ...doc.data() } as Workflow;
      console.log(
        `[onFormSubmission] firing workflow ${wf.id} for submission ${event.params.submissionId}`
      );
      tasks.push(
        runWorkflow(wf, "form_submit").catch((err) => {
          console.error(`[onFormSubmission] failed for ${wf.id}:`, err);
        })
      );
    }
    await Promise.all(tasks);
  }
);
