"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type Message = {
  text: string;
  tone: "good" | "bad";
};

function getAuthMessage(code: string) {
  if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
    return "wrong email or password";
  }
  if (code === "auth/email-already-in-use") {
    return "that email is already taken";
  }
  if (code === "auth/weak-password") {
    return "password should be at least 6 characters";
  }
  if (code === "auth/invalid-email") {
    return "that email does not look valid";
  }
  return "something went wrong, try again";
}

function getErrorCode(err: unknown) {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: string }).code);
  }
  return "error";
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const startingMode = searchParams.get("mode") === "up" ? "up" : "in";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"in" | "up">(startingMode);

  useEffect(() => {
    setMode(startingMode);
    setMessage(null);
  }, [startingMode]);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setBusy(true);
    try {
      if (mode === "in") await signIn(email, password);
      else await signUp(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setMessage({ text: getAuthMessage(getErrorCode(err)), tone: "bad" });
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    const cleanEmail = email.trim();
    setMessage(null);
    if (!cleanEmail) {
      setMessage({ text: "enter your email first", tone: "bad" });
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email);
      setMessage({
        text: "password reset email sent if that account exists",
        tone: "good",
      });
    } catch (err: unknown) {
      setMessage({ text: getAuthMessage(getErrorCode(err)), tone: "bad" });
    } finally {
      setBusy(false);
    }
  }

  function toggleMode() {
    setMode(mode === "in" ? "up" : "in");
    setMessage(null);
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-100 px-4 py-16 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {mode === "in" ? "Log in" : "Create account"}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          workflow automation platform
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              email
            </label>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              password
            </label>
            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {mode === "in" ? (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={busy}
              className="text-xs font-medium text-zinc-500 underline hover:text-zinc-900 disabled:opacity-50 dark:hover:text-zinc-200"
            >
              forgot password?
            </button>
          ) : null}

          {message ? (
            <p
              className={
                message.tone === "good"
                  ? "text-sm text-emerald-600 dark:text-emerald-400"
                  : "text-sm text-red-600 dark:text-red-400"
              }
            >
              {message.text}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {busy ? "wait..." : mode === "in" ? "Log in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={toggleMode}
          className="mt-4 w-full text-center text-sm text-zinc-600 underline dark:text-zinc-400"
        >
          {mode === "in"
            ? "need an account? sign up"
            : "already have account? log in"}
        </button>

        <Link
          href="/"
          className="mt-6 block text-center text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
        >
          back home
        </Link>
      </div>
    </div>
  );
}
