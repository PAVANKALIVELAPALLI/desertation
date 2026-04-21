import Link from "next/link";

const FEATURES = [
  {
    title: "Visual workflow builder",
    body: "Compose steps, triggers, conditions, and branches without writing code.",
  },
  {
    title: "Scheduled & manual runs",
    body: "Cron-backed automation with one-click ad-hoc execution.",
  },
  {
    title: "Full execution logs",
    body: "See per-step inputs, outputs, errors, and durations for every run.",
  },
  {
    title: "Analytics dashboard",
    body: "Success rates, volume, and health signals across all your workflows.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-semibold tracking-tight">
            Workflow<span className="text-zinc-400">.app</span>
          </span>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/login"
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-20 px-6 py-20">
        <section className="flex flex-col gap-6">
          <span className="inline-flex w-fit rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            Dissertation project · Workflow automation platform
          </span>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Automate recurring work with a few clicks, not a deployment.
          </h1>
          <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
            Build workflows out of reusable steps - notifications, record
            updates, conditions, delays, HTTP calls - then run them on demand or
            on a schedule. All runs are logged and measurable.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Open the dashboard
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Create an account
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h2 className="text-sm font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {f.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 dark:border-zinc-800">
        Built with Next.js, Firebase Auth, Firestore, and Cloud Functions.
      </footer>
    </div>
  );
}
