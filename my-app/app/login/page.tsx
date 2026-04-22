"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      if (mode === "in") await signIn(email, password);
      else await signUp(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "error";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setMsg("wrong email or password");
      } else if (code === "auth/email-already-in-use") {
        setMsg("that email is already taken");
      } else if (code === "auth/weak-password") {
        setMsg("password should be at least 6 characters");
      } else if (code === "auth/invalid-email") {
        setMsg("that email does not look valid");
      } else {
        setMsg("something went wrong, try again");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-16 bg-zinc-100 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {mode === "in" ? "Log in" : "Sign up"}
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
            <input
              type="password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              required
              minLength={6}
            />
          </div>

          {msg ? (
            <p className="text-sm text-red-600 dark:text-red-400">{msg}</p>
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
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setMsg("");
          }}
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
