import type { Workflow } from "@/types/workflow";

type Template = Omit<Workflow, "id" | "userId" | "createdAt" | "updatedAt">;

export const SAMPLE_WORKFLOWS: Template[] = [
  {
    name: "Daily weather email",
    description:
      "Every morning at 08:00 UTC, fetch a one-line weather report for Dublin and email it. Change the city in the URL and put your address on the email step, then activate.",
    status: "draft",
    trigger: { type: "schedule", config: { cron: "0 8 * * *" } },
    lastRunAt: null,
    runCount: 0,
    steps: [
      {
        id: "weather_email",
        name: "Fetch and email weather",
        type: "send_notification",
        order: 0,
        priority: 0,
        retries: 0,
        config: {
          notificationChannel: "email",
          emailTo: "you@example.com",
          emailSubject: "Today's weather",
          bodyUrl: "https://wttr.in/Dublin?format=3",
        },
      },
    ],
  },

  {
    name: "API health check",
    description:
      "Every hour, ping an endpoint. If it does not respond OK, send an email alert. Replace the URL with your service and put your email on the alert step.",
    status: "draft",
    trigger: { type: "schedule", config: { cron: "0 * * * *" } },
    lastRunAt: null,
    runCount: 0,
    steps: [
      {
        id: "health_ping",
        name: "Ping the API",
        type: "http_request",
        order: 0,
        priority: 0,
        retries: 2,
        continueOnError: true,
        config: {
          url: "https://httpbin.org/status/200",
          method: "GET",
        },
      },
      {
        id: "health_check",
        name: "Did it respond OK?",
        type: "condition",
        order: 1,
        priority: 0,
        retries: 0,
        config: {
          conditionField: "ok",
          conditionOp: "==",
          conditionValue: "true",
          onTrueStepId: "health_ok",
          onFalseStepId: "health_alert",
        },
      },
      {
        id: "health_ok",
        name: "Log healthy",
        type: "log_event",
        order: 2,
        priority: 0,
        retries: 0,
        config: { message: "API responded OK" },
      },
      {
        id: "health_alert",
        name: "Email alert",
        type: "send_notification",
        order: 3,
        priority: 0,
        retries: 0,
        config: {
          notificationChannel: "email",
          emailTo: "you@example.com",
          emailSubject: "API health alert",
          message: "API did not respond OK. Investigate.",
        },
      },
    ],
  },

  {
    name: "Daily Bitcoin price",
    description:
      "Every morning at 09:00 UTC, fetch the current Bitcoin price in USD from CoinGecko and email it. Put your address on the email step, then activate.",
    status: "draft",
    trigger: { type: "schedule", config: { cron: "0 9 * * *" } },
    lastRunAt: null,
    runCount: 0,
    steps: [
      {
        id: "btc_fetch",
        name: "Fetch BTC price",
        type: "http_request",
        order: 0,
        priority: 0,
        retries: 1,
        config: {
          url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
          method: "GET",
        },
      },
      {
        id: "btc_email",
        name: "Email the price",
        type: "send_notification",
        order: 1,
        priority: 0,
        retries: 0,
        config: {
          notificationChannel: "email",
          emailTo: "you@example.com",
          emailSubject: "Bitcoin price today",
          message: "Bitcoin: ${{body.bitcoin.usd}} USD",
        },
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
