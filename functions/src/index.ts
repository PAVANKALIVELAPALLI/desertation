import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as nodemailer from "nodemailer";
import { Workflow } from "./types";
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
