export type TriggerType = "manual" | "schedule" | "form_submit";

export interface TriggerConfig {
  cron?: string;
  formId?: string;
}

export interface WorkflowTrigger {
  type: TriggerType;
  config: TriggerConfig;
}

export type StepType =
  | "send_notification"
  | "update_record"
  | "log_event"
  | "condition"
  | "delay"
  | "http_request";

export type ConditionOp = "==" | "!=" | ">" | "<" | ">=" | "<=";

export interface StepConfig {
  notificationChannel?: "app" | "email";
  message?: string;
  emailTo?: string;
  emailSubject?: string;
  collection?: string;
  field?: string;
  value?: string;
  conditionField?: string;
  conditionOp?: ConditionOp;
  conditionValue?: string;
  onTrueStepId?: string;
  onFalseStepId?: string;
  delaySeconds?: number;
  url?: string;
  method?: "GET" | "POST";
  body?: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  config: StepConfig;
  order: number;
  priority?: number;
  retries?: number;
  continueOnError?: boolean;
}

export type WorkflowStatus = "active" | "inactive" | "draft";

export interface Workflow {
  id?: string;
  userId: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number | null;
  runCount?: number;
}

export type ExecutionStatus = "running" | "completed" | "failed";

export interface Execution {
  id?: string;
  workflowId: string;
  workflowName: string;
  userId: string;
  status: ExecutionStatus;
  triggeredBy: TriggerType;
  startedAt: number;
  completedAt: number | null;
  error: string | null;
  stepsCompleted: number;
  stepsTotal: number;
}

export type LogLevel = "info" | "warn" | "error";

export interface ExecutionLog {
  id?: string;
  executionId: string;
  workflowId: string;
  stepId: string;
  stepName: string;
  level: LogLevel;
  message: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  error: string | null;
  timestamp: number;
  durationMs: number | null;
}

export const STEP_TYPE_META: Record<StepType, { label: string; description: string }> = {
  send_notification: {
    label: "Send notification",
    description: "Create an app notification or email-ready notification.",
  },
  update_record: {
    label: "Update record",
    description: "Write a field/value pair into a Firestore collection.",
  },
  log_event: {
    label: "Log event",
    description: "Append a custom log line to this execution.",
  },
  condition: {
    label: "Condition (if/then)",
    description: "Branch execution based on context values.",
  },
  delay: {
    label: "Delay",
    description: "Pause execution for N seconds (capped).",
  },
  http_request: {
    label: "HTTP request",
    description: "Call an external HTTP endpoint.",
  },
};

export const TRIGGER_TYPE_META: Record<TriggerType, { label: string; description: string }> = {
  manual: {
    label: "Manual",
    description: "Run the workflow on demand from the dashboard.",
  },
  schedule: {
    label: "Schedule (CRON)",
    description: "Fire on a recurring cron expression.",
  },
  form_submit: {
    label: "Form submit",
    description: "Start when a given form document is created.",
  },
};
