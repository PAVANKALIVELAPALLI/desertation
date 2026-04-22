import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getFirebaseApp, getFirestore } from "./firebase";
import type {
  Execution,
  ExecutionLog,
  Workflow,
} from "@/types/workflow";

export async function createWorkflow(data: Omit<Workflow, "id">) {
  const ref = await addDoc(collection(getFirestore(), "workflows"), data);
  return ref.id;
}

export async function createWorkflowsBatch(
  items: Omit<Workflow, "id">[]
): Promise<void> {
  if (items.length === 0) return;
  const db = getFirestore();
  const batch = writeBatch(db);
  const col = collection(db, "workflows");
  for (const item of items) {
    batch.set(doc(col), item);
  }
  await batch.commit();
}

export async function updateWorkflow(id: string, data: Partial<Workflow>) {
  await updateDoc(doc(getFirestore(), "workflows", id), {
    ...data,
    updatedAt: Date.now(),
  });
}

export async function deleteWorkflow(id: string) {
  await deleteDoc(doc(getFirestore(), "workflows", id));
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const snap = await getDoc(doc(getFirestore(), "workflows", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Workflow;
}

export async function getUserWorkflows(userId: string): Promise<Workflow[]> {
  const q = query(
    collection(getFirestore(), "workflows"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workflow);
}

export async function createExecution(data: Omit<Execution, "id">) {
  const ref = await addDoc(collection(getFirestore(), "executions"), data);
  return ref.id;
}

export async function updateExecution(id: string, data: Partial<Execution>) {
  await updateDoc(doc(getFirestore(), "executions", id), data);
}

export async function getExecution(id: string): Promise<Execution | null> {
  const snap = await getDoc(doc(getFirestore(), "executions", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Execution;
}

export async function getWorkflowExecutions(
  workflowId: string,
  max = 50
): Promise<Execution[]> {
  const q = query(
    collection(getFirestore(), "executions"),
    where("workflowId", "==", workflowId),
    orderBy("startedAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Execution);
}

export async function getUserExecutions(
  userId: string,
  max = 100
): Promise<Execution[]> {
  const q = query(
    collection(getFirestore(), "executions"),
    where("userId", "==", userId),
    orderBy("startedAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Execution);
}

export async function addExecutionLog(data: Omit<ExecutionLog, "id">) {
  const ref = await addDoc(collection(getFirestore(), "executionLogs"), data);
  return ref.id;
}

export async function getExecutionLogs(
  executionId: string
): Promise<ExecutionLog[]> {
  const q = query(
    collection(getFirestore(), "executionLogs"),
    where("executionId", "==", executionId),
    orderBy("timestamp", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExecutionLog);
}

export async function runWorkflowNow(workflowId: string): Promise<void> {
  const fns = getFunctions(getFirebaseApp());
  const callable = httpsCallable(fns, "executeWorkflow");
  await callable({ workflowId });
}
