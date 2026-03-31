"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function DashboardPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setChecking(false);
      if (!user) {
        router.replace("/login");
        return;
      }
      setEmail(user.email);
    });
    return () => unsub();
  }, [router]);

  async function logout() {
    await signOut(auth);
    router.push("/login");
  }

  if (checking) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-full">
        <p className="text-zinc-500">loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold">dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          logged in as {email}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={logout}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
          >
            log out
          </button>
          <Link
            href="/"
            className="rounded-md bg-zinc-900 px-4 py-2 text-center text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            home
          </Link>
        </div>
      </div>
    </div>
  );
}
