"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { WorkflowEditor } from "@/components/WorkflowEditor";
import { createWorkflow } from "@/lib/firestore";
import { blankWorkflow } from "@/lib/workflow-schema";

export default function NewWorkflowPage() {
  const router = useRouter();
  const { user } = useAuth();

  if (!user) return null;

  const initial = blankWorkflow(user.uid);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/workflows"
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Back to workflows
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          New workflow
        </h1>
      </div>

      <WorkflowEditor
        initial={initial}
        saveLabel="Create workflow"
        onSave={async (draft) => {
          const id = await createWorkflow({ ...draft, userId: user.uid });
          router.push(`/dashboard/workflows/${id}`);
        }}
      />
    </div>
  );
}
