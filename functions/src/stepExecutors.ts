import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
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

async function runSendNotification(
  step: WorkflowStep,
  context: Record<string, unknown>
): Promise<StepResult> {
  const message = resolveTemplate(
    step.config.message || "no message set",
    context
  );
  const channel =
    step.config.notificationChannel || (step.config.emailTo ? "email" : "app");

  if (channel === "email") {
    if (!step.config.emailTo) {
      return {
        success: false,
        output: {},
        error: "email recipient is required",
      };
    }
    const subject = resolveTemplate(
      step.config.emailSubject || step.name,
      context
    );
    const to = resolveTemplate(step.config.emailTo, context);
    const mailer = getMailer();
    const fromAddress =
      process.env.GMAIL_USER || "noreply@desertation-ccace.web.app";
    const fromHeader = `Workflow App <${fromAddress}>`;

    if (!mailer) {
      console.warn(
        "[notification:email] mailer not configured — falling back to mailto"
      );
      return {
        success: true,
        output: {
          channel,
          to,
          subject,
          message,
          mailto: buildMailto(to, subject, message),
          status: "ready",
          warning: "GMAIL_USER / GMAIL_APP_PASSWORD secrets not set",
          preparedAt: Date.now(),
        },
      };
    }

    try {
      const info = await mailer.sendMail({
        from: fromHeader,
        to,
        subject,
        text: message,
        html: `<p>${escapeHtml(message)}</p>`,
      });
      console.log(`[notification:email] sent ${info.messageId} to ${to}`);
      return {
        success: true,
        output: {
          channel,
          to,
          subject,
          message,
          status: "sent",
          messageId: info.messageId,
          accepted: info.accepted,
          sentAt: Date.now(),
        },
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[notification:email] failed: ${errMsg}`);
      return {
        success: false,
        output: { channel, to, subject, message, status: "failed" },
        error: errMsg,
      };
    }
  }

  console.log(`[notification:app] ${message}`);
  return {
    success: true,
    output: { channel, message, sentAt: Date.now() },
  };
}

function buildMailto(to: string, subject: string, body: string): string {
  const params = new URLSearchParams({ subject, body });
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

async function runLogEvent(
  step: WorkflowStep,
  context: Record<string, unknown>
): Promise<StepResult> {
  const message = resolveTemplate(
    step.config.message || "event logged",
    context
  );
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
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    const out: Record<string, unknown> = {
      status: res.status,
      ok: res.ok,
      body: parsed ?? text.slice(0, 2048),
      bodyText: text.slice(0, 2048),
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

function resolveTemplate(
  template: string | undefined,
  context: Record<string, unknown>
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

export async function executeStep(
  step: WorkflowStep,
  context: Record<string, unknown>
): Promise<StepResult> {
  switch (step.type) {
    case "send_notification":
      return runSendNotification(step, context);
    case "update_record":
      return runUpdateRecord(step);
    case "log_event":
      return runLogEvent(step, context);
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
