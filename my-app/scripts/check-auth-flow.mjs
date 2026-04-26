import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const homeSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const loginPageSource = readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");
const loginFormSource = readFileSync(new URL("../app/login/LoginForm.tsx", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../lib/auth-context.tsx", import.meta.url), "utf8");

assert.match(
  homeSource,
  /href="\/login\?mode=up"/,
  "create account links should open the signup form",
);

assert.match(
  loginPageSource,
  /<Suspense/,
  "login page should wrap query-param form in suspense",
);

assert.match(
  loginFormSource,
  /useSearchParams\(\)/,
  "login form should read mode from the URL",
);

assert.match(
  loginFormSource,
  /resetPassword\(email\)/,
  "login form should call resetPassword from forgot password",
);

assert.match(
  loginFormSource,
  /forgot password\?/i,
  "login form should show a forgot password action",
);

assert.match(
  authSource,
  /sendPasswordResetEmail/,
  "auth context should use Firebase password reset emails",
);

assert.match(
  authSource,
  /resetPassword: \(email: string\) => Promise<void>/,
  "auth context should expose resetPassword",
);

console.log("auth flow checks passed");
