import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const editorSource = readFileSync(
  new URL("../components/WorkflowEditor.tsx", import.meta.url),
  "utf8",
);
const schemaSource = readFileSync(
  new URL("../lib/workflow-schema.ts", import.meta.url),
  "utf8",
);
const firestoreSource = readFileSync(
  new URL("../lib/firestore.ts", import.meta.url),
  "utf8",
);
const typesSource = readFileSync(
  new URL("../types/workflow.ts", import.meta.url),
  "utf8",
);
const functionsTypesSource = readFileSync(
  new URL("../../functions/src/types.ts", import.meta.url),
  "utf8",
);
const functionsExecutorSource = readFileSync(
  new URL("../../functions/src/stepExecutors.ts", import.meta.url),
  "utf8",
);

assert.match(
  schemaSource,
  /const name = `New step \$\{order \+ 1\}`/,
  "new workflow steps should get distinguishable default names",
);

assert.match(
  editorSource,
  /function formatStepOption/,
  "condition step dropdown should use a clear formatted label",
);

assert.match(
  editorSource,
  /STEP_TYPE_META\[option\.type\]\.label/,
  "condition step dropdown should include each target step type",
);

assert.match(
  editorSource,
  /clearStepRefs/,
  "removing a step should clear condition branches that target it",
);

assert.match(
  schemaSource,
  /unknown onTrueStepId/,
  "workflow validation should reject missing true branch targets",
);

assert.match(
  schemaSource,
  /unknown onFalseStepId/,
  "workflow validation should reject missing false branch targets",
);

assert.match(
  typesSource,
  /notificationChannel\?: "app" \| "email"/,
  "app workflow types should support email notifications",
);

assert.match(
  functionsTypesSource,
  /notificationChannel\?: "app" \| "email"/,
  "functions workflow types should match app notification fields",
);

assert.match(
  editorSource,
  /Email to/,
  "notification editor should expose an email recipient field",
);

assert.match(
  firestoreSource,
  /buildMailto/,
  "client workflow runner should prepare email notification output",
);

assert.match(
  functionsExecutorSource,
  /buildMailto/,
  "functions workflow runner should prepare matching email notification output",
);

console.log("workflow audit checks passed");
