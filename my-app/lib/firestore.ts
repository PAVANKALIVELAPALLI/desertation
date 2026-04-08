import { getFirestore } from "./firebase";
import type { Workflow, Execution, ExecutionLog } from "@/types/workflow";

export async function createWorkflow(data: Omit<Workflow, "id">) {
  const db = await getFirestore();
  const { collection, addDoc } = await import("firebase/firestore");
  const ref = await addDoc(collection(db, "workflows"), data);
  return ref.id;
}

export async function updateWorkflow(id: string, data: Partial<Workflow>) {
  const db = await getFirestore();
  const { doc, updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(db, "workflows", id), { ...data, updatedAt: Date.now() });
}

export async function deleteWorkflow(id: string) {
  const db = await getFirestore();
  const { doc, deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(db, "workflows", id));
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const db = await getFirestore();
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(db, "workflows", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Workflow;
}

export async function getUserWorkflows(userId: string): Promise<Workflow[]> {
  const db = await getFirestore();
  const { collection, query, where, orderBy, getDocs } = await import(
    "firebase/firestore"
  );
  const q = query(
    collection(db, "workflows"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Workflow);
}

export async function createExecution(data: Omit<Execution, "id">) {
  const db = await getFirestore();
  const { collection, addDoc } = await import("firebase/firestore");
  const ref = await addDoc(collection(db, "executions"), data);
  return ref.id;
}

export async function updateExecution(id: string, data: Partial<Execution>) {
  const db = await getFirestore();
  const { doc, updateDoc } = await import("firebase/firestore");
  await updateDoc(doc(db, "executions", id), data);
}

export async function getWorkflowExecutions(
  workflowId: string
): Promise<Execution[]> {
  const db = await getFirestore();
  const { collection, query, where, orderBy, getDocs } = await import(
    "firebase/firestore"
  );
  const q = query(
    collection(db, "executions"),
    where("workflowId", "==", workflowId),
    orderBy("startedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Execution);
}

export async function addExecutionLog(data: Omit<ExecutionLog, "id">) {
  const db = await getFirestore();
  const { collection, addDoc } = await import("firebase/firestore");
  const ref = await addDoc(collection(db, "executionLogs"), data);
  return ref.id;
}

export async function getExecutionLogs(
  executionId: string
): Promise<ExecutionLog[]> {
  const db = await getFirestore();
  const { collection, query, where, orderBy, getDocs } = await import(
    "firebase/firestore"
  );
  const q = query(
    collection(db, "executionLogs"),
    where("executionId", "==", executionId),
    orderBy("timestamp", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ExecutionLog);
}
