import type {
  StepType,
  TriggerType,
  Workflow,
  WorkflowStep,
  WorkflowTrigger,
} from "@/types/workflow";

const STEP_TYPES: StepType[] = [
  "send_notification",
  "update_record",
  "log_event",
  "condition",
  "delay",
  "http_request",
];

const TRIGGER_TYPES: TriggerType[] = ["manual", "schedule", "form_submit"];

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const ranges = [
    [0, 59],
    [0, 23],
    [1, 31],
    [1, 12],
    [0, 6],
  ];
  return parts.every((part, i) => validateCronField(part, ranges[i][0], ranges[i][1]));
}

function validateCronField(field: string, lo: number, hi: number): boolean {
  if (field === "*") return true;

  if (field.includes("/")) {
    const [range, stepStr] = field.split("/");
    const step = parseInt(stepStr, 10);
    if (!Number.isFinite(step) || step <= 0) return false;
    if (range !== "*" && !validateCronField(range, lo, hi)) return false;
    return true;
  }

  if (field.includes(",")) {
    return field.split(",").every((v) => validateCronField(v, lo, hi));
  }

  if (field.includes("-")) {
    const [a, b] = field.split("-").map((v) => parseInt(v, 10));
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return a >= lo && b <= hi && a <= b;
  }

  const n = parseInt(field, 10);
  return Number.isFinite(n) && n >= lo && n <= hi;
}

function validateTrigger(t: WorkflowTrigger, errors: string[]): void {
  if (!t || !TRIGGER_TYPES.includes(t.type)) {
    errors.push("trigger.type is invalid");
    return;
  }
  if (t.type === "schedule") {
    const cron = t.config?.cron?.trim();
    if (!cron) errors.push("schedule trigger requires a cron expression");
    else if (!validateCron(cron)) errors.push(`invalid cron expression: "${cron}"`);
  }
  if (t.type === "form_submit") {
    if (!t.config?.formId) errors.push("form_submit trigger requires a formId");
  }
}

function validateStep(step: WorkflowStep, index: number, errors: string[]): void {
  const prefix = `step[${index}] "${step.name || step.id || "untitled"}"`;
  if (!step.id) errors.push(`${prefix}: missing id`);
  if (!step.name) errors.push(`${prefix}: missing name`);
  if (!STEP_TYPES.includes(step.type)) {
    errors.push(`${prefix}: unknown type "${step.type}"`);
    return;
  }
  const c = step.config || {};
  switch (step.type) {
    case "send_notification":
    case "log_event":
      if (!c.message) errors.push(`${prefix}: message is required`);
      break;
    case "update_record":
      if (!c.collection) errors.push(`${prefix}: collection is required`);
      if (!c.field) errors.push(`${prefix}: field is required`);
      break;
    case "condition":
      if (!c.conditionField)
        errors.push(`${prefix}: conditionField is required`);
      if (!c.conditionOp) errors.push(`${prefix}: conditionOp is required`);
      if (c.conditionValue === undefined || c.conditionValue === "")
        errors.push(`${prefix}: conditionValue is required`);
      break;
    case "delay": {
      const d = Number(c.delaySeconds);
      if (!Number.isFinite(d) || d < 0)
        errors.push(`${prefix}: delaySeconds must be a non-negative number`);
      break;
    }
    case "http_request":
      if (!c.url) errors.push(`${prefix}: url is required`);
      if (c.method && c.method !== "GET" && c.method !== "POST")
        errors.push(`${prefix}: method must be GET or POST`);
      break;
  }
}

export function validateWorkflow(w: Partial<Workflow>): ValidationResult {
  const errors: string[] = [];
  if (!w.name || !w.name.trim()) errors.push("name is required");
  if (!w.userId) errors.push("userId is required");
  if (!w.trigger) errors.push("trigger is required");
  else validateTrigger(w.trigger, errors);

  if (!Array.isArray(w.steps) || w.steps.length === 0) {
    errors.push("at least one step is required");
  } else {
    const seen = new Set<string>();
    w.steps.forEach((s, i) => {
      if (s.id) {
        if (seen.has(s.id)) errors.push(`duplicate step id: ${s.id}`);
        seen.add(s.id);
      }
      validateStep(s, i, errors);
    });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function newStepId(): string {
  return `step_${Math.random().toString(36).slice(2, 9)}`;
}

export function blankStep(order: number): WorkflowStep {
  return {
    id: newStepId(),
    name: "New step",
    type: "log_event",
    config: { message: "" },
    order,
    priority: 0,
    retries: 0,
    continueOnError: false,
  };
}

export function blankWorkflow(userId: string): Omit<Workflow, "id"> {
  const now = Date.now();
  return {
    userId,
    name: "Untitled workflow",
    description: "",
    status: "draft",
    trigger: { type: "manual", config: {} },
    steps: [blankStep(0)],
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
    runCount: 0,
  };
}
