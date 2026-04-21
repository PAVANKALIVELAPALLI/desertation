import type { Workflow } from "@/types/workflow";

type Template = Omit<Workflow, "id" | "userId" | "createdAt" | "updatedAt">;

export const SAMPLE_WORKFLOWS: Template[] = [
  {
    name: "Welcome new sign-ups",
    description:
      "Starter workflow. Logs a welcome event and fires a notification whenever it is manually run.",
    status: "active",
    trigger: { type: "manual", config: {} },
    lastRunAt: null,
    runCount: 0,
    steps: [
      {
        id: "w1_s1",
        name: "Log welcome event",
        type: "log_event",
        order: 0,
        priority: 0,
        retries: 0,
        config: { message: "New user welcomed" },
      },
      {
        id: "w1_s2",
        name: "Send welcome notification",
        type: "send_notification",
        order: 1,
        priority: 0,
        retries: 0,
        config: { message: "Welcome to the platform - glad to have you!" },
      },
    ],
  },

  {
    name: "Daily 9am summary",
    description:
      "Scheduled workflow. Writes a daily-summary record to Firestore every morning and logs the event.",
    status: "active",
    trigger: { type: "schedule", config: { cron: "0 9 * * *" } },
    lastRunAt: null,
    runCount: 0,
    steps: [
      {
        id: "w2_s1",
        name: "Stamp summary record",
        type: "update_record",
        order: 0,
        priority: 10,
        retries: 1,
        config: {
          collection: "dailySummaries",
          field: "note",
          value: "auto-generated morning digest",
        },
      },
      {
        id: "w2_s2",
        name: "Log digest",
        type: "log_event",
        order: 1,
        priority: 0,
        retries: 0,
        config: { message: "Morning digest written to Firestore" },
      },
    ],
  },

  {
    name: "High-priority alert with fallback",
    description:
      "Condition step branches: if the last HTTP check failed, alert; otherwise just log. Demonstrates branching via onTrue/onFalse.",
    status: "active",
    trigger: { type: "manual", config: {} },
    lastRunAt: null,
    runCount: 0,
    steps: [
      {
        id: "w3_s1",
        name: "Ping health endpoint",
        type: "http_request",
        order: 0,
        priority: 5,
        retries: 2,
        continueOnError: true,
        config: {
          url: "https://httpbin.org/status/200",
          method: "GET",
        },
      },
      {
        id: "w3_s2",
        name: "Did the check pass?",
        type: "condition",
        order: 1,
        priority: 5,
        retries: 0,
        config: {
          conditionField: "ok",
          conditionOp: "==",
          conditionValue: "true",
          onTrueStepId: "w3_s4",
          onFalseStepId: "w3_s3",
        },
      },
      {
        id: "w3_s3",
        name: "Alert on failure",
        type: "send_notification",
        order: 2,
        priority: 0,
        retries: 0,
        config: {
          message: "Health endpoint did NOT respond OK - investigate.",
        },
      },
      {
        id: "w3_s4",
        name: "Record success",
        type: "log_event",
        order: 3,
        priority: 0,
        retries: 0,
        config: { message: "Health endpoint responded OK." },
      },
    ],
  },

  {
    name: "Retrying webhook call",
    description:
      "Calls an external webhook with up to 3 retries and an exponential back-off. Useful for flaky third-party integrations.",
    status: "inactive",
    trigger: { type: "manual", config: {} },
    lastRunAt: null,
    runCount: 0,
    steps: [
      {
        id: "w4_s1",
        name: "POST to partner webhook",
        type: "http_request",
        order: 0,
        priority: 0,
        retries: 3,
        config: {
          url: "https://httpbin.org/post",
          method: "POST",
          body: JSON.stringify({ event: "sync", source: "dissertation" }),
        },
      },
      {
        id: "w4_s2",
        name: "Log delivery",
        type: "log_event",
        order: 1,
        priority: 0,
        retries: 0,
        config: { message: "Webhook delivered" },
      },
    ],
  },

  {
    name: "Slow onboarding drip",
    description:
      "Manual workflow that sends a message, waits briefly, then follows up. Demonstrates the delay step.",
    status: "draft",
    trigger: { type: "manual", config: {} },
    lastRunAt: null,
    runCount: 0,
    steps: [
      {
        id: "w5_s1",
        name: "Send first touch",
        type: "send_notification",
        order: 0,
        priority: 0,
        retries: 0,
        config: { message: "Hey! Thanks for joining - here is step one." },
      },
      {
        id: "w5_s2",
        name: "Wait a moment",
        type: "delay",
        order: 1,
        priority: 0,
        retries: 0,
        config: { delaySeconds: 5 },
      },
      {
        id: "w5_s3",
        name: "Send follow-up",
        type: "send_notification",
        order: 2,
        priority: 0,
        retries: 0,
        config: { message: "Here is the follow-up with next steps." },
      },
      {
        id: "w5_s4",
        name: "Log completion",
        type: "log_event",
        order: 3,
        priority: 0,
        retries: 0,
        config: { message: "Drip sequence finished" },
      },
    ],
  },

  {
    name: "Form-triggered lead router",
    description:
      "Triggered by new lead-form submissions. Writes the lead to a collection then branches by priority value.",
    status: "inactive",
    trigger: { type: "form_submit", config: { formId: "lead-intake-v1" } },
    lastRunAt: null,
    runCount: 0,
    steps: [
      {
        id: "w6_s1",
        name: "Save lead record",
        type: "update_record",
        order: 0,
        priority: 10,
        retries: 1,
        config: { collection: "leads", field: "source", value: "web-form" },
      },
      {
        id: "w6_s2",
        name: "Is lead high value?",
        type: "condition",
        order: 1,
        priority: 0,
        retries: 0,
        config: {
          conditionField: "value",
          conditionOp: ">",
          conditionValue: "1000",
          onTrueStepId: "w6_s3",
          onFalseStepId: "w6_s4",
        },
      },
      {
        id: "w6_s3",
        name: "Page sales manager",
        type: "send_notification",
        order: 2,
        priority: 0,
        retries: 0,
        config: { message: "High-value lead - escalate to sales manager" },
      },
      {
        id: "w6_s4",
        name: "Queue standard follow-up",
        type: "log_event",
        order: 3,
        priority: 0,
        retries: 0,
        config: { message: "Standard follow-up queued" },
      },
    ],
  },
];

export function materializeSample(
  template: Template,
  userId: string,
): Omit<Workflow, "id"> {
  const now = Date.now();
  const suffix = Math.random().toString(36).slice(2, 6);
  return {
    ...template,
    userId,
    createdAt: now,
    updatedAt: now,
    steps: template.steps.map((s) => ({
      ...s,
      id: `${s.id}_${suffix}`,
      config: remapStepRefs(s.config, suffix),
    })),
  };
}

function remapStepRefs(
  config: Template["steps"][number]["config"],
  suffix: string,
): Template["steps"][number]["config"] {
  const next = { ...config };
  if (next.onTrueStepId) next.onTrueStepId = `${next.onTrueStepId}_${suffix}`;
  if (next.onFalseStepId)
    next.onFalseStepId = `${next.onFalseStepId}_${suffix}`;
  return next;
}
