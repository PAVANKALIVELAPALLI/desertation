import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const firestoreSource = readFileSync(
  new URL("../lib/firestore.ts", import.meta.url),
  "utf8",
);
const rulesSource = readFileSync(
  new URL("../../firestore.rules", import.meta.url),
  "utf8",
);
const firebaseConfigSource = readFileSync(
  new URL("../../firebase.json", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  firestoreSource,
  /firebase\/functions|getFunctions|httpsCallable/,
  "runWorkflowNow should not call Cloud Functions on the Spark plan",
);

assert.match(
  firestoreSource,
  /export async function runWorkflowNow\(workflowId: string\): Promise<void>/,
  "runWorkflowNow should stay as the existing client API",
);

assert.match(
  firestoreSource,
  /await addDoc\(collection\(db, "executions"\)/,
  "runWorkflowNow should create execution documents directly",
);

assert.match(
  firestoreSource,
  /await addDoc\(collection\(db, "executionLogs"\)/,
  "runWorkflowNow should write execution logs directly",
);

assert.match(
  rulesSource,
  /match \/executions\/\{executionId\}[\s\S]*allow create: if isOwner\(request\.resource\.data\.userId\)/,
  "rules should allow users to create their own executions",
);

assert.match(
  rulesSource,
  /match \/executionLogs\/\{logId\}[\s\S]*allow create: if canAccessExecution\(request\.resource\.data\.executionId\)/,
  "rules should allow users to create logs for their own executions",
);

assert.doesNotMatch(
  firebaseConfigSource,
  /"functions"/,
  "default Firebase deploy should not require Cloud Functions on Spark",
);

console.log("Spark workflow runner checks passed");
