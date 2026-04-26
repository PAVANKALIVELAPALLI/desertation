import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const firestoreSource = readFileSync(
  new URL("../lib/firestore.ts", import.meta.url),
  "utf8",
);
const workflowDetailSource = readFileSync(
  new URL("../app/dashboard/workflows/[id]/page.tsx", import.meta.url),
  "utf8",
);
const executionDetailSource = readFileSync(
  new URL("../app/dashboard/executions/[id]/page.tsx", import.meta.url),
  "utf8",
);

assert.match(
  firestoreSource,
  /export async function getWorkflowExecutions\(\s*workflowId: string,\s*userId: string,/,
  "getWorkflowExecutions should require the signed-in user id",
);

assert.match(
  firestoreSource,
  /where\("workflowId", "==", workflowId\),[\s\S]*where\("userId", "==", userId\),/,
  "workflow execution queries must scope by both workflowId and userId",
);

assert.match(
  workflowDetailSource,
  /catch \(err: unknown\)/,
  "workflow detail loading should catch Firestore read failures",
);

assert.match(
  executionDetailSource,
  /catch \(err: unknown\)/,
  "execution detail loading should catch Firestore read failures",
);

console.log("detail Firestore access guards are in place");
