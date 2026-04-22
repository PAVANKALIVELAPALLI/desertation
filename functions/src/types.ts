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
  message?: string;
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

export interface Workflow {
  id?: string;
  userId: string;
  name: string;
  description: string;
  status: "active" | "inactive" | "draft";
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
