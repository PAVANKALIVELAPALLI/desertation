"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  collection,
  limit as qLimit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestore } from "./firebase";
import type { Execution, Workflow } from "@/types/workflow";

type StreamState<T> = {
  data: T[];
  loading: boolean;
  error: Error | null;
  userId: string | null;
  refCount: number;
  unsub: Unsubscribe | null;
};

function newState<T>(): StreamState<T> {
  return {
    data: [],
    loading: true,
    error: null,
    userId: null,
    refCount: 0,
    unsub: null,
  };
}

const workflowsState = newState<Workflow>();
const executionsState = newState<Execution>();

const listeners = new Set<() => void>();

function subscribeStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach((l) => l());
}

function getWorkflowsSnapshot(): Workflow[] {
  return workflowsState.data;
}

function getExecutionsSnapshot(): Execution[] {
  return executionsState.data;
}

function startWorkflows(userId: string) {
  if (workflowsState.userId !== userId) {
    workflowsState.unsub?.();
    workflowsState.unsub = null;
    workflowsState.data = [];
    workflowsState.loading = true;
    workflowsState.error = null;
    workflowsState.userId = userId;
    workflowsState.refCount = 0;
  }

  workflowsState.refCount++;

  if (workflowsState.unsub) return;

  const q = query(
    collection(getFirestore(), "workflows"),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );

  workflowsState.unsub = onSnapshot(
    q,
    (snap) => {
      workflowsState.data = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Workflow
      );
      workflowsState.loading = false;
      workflowsState.error = null;
      emit();
    },
    (err) => {
      workflowsState.loading = false;
      workflowsState.error = err;
      emit();
    }
  );
}

function stopWorkflows() {
  workflowsState.refCount = Math.max(0, workflowsState.refCount - 1);
  if (workflowsState.refCount === 0 && workflowsState.unsub) {
    workflowsState.unsub();
    workflowsState.unsub = null;
  }
}

function startExecutions(userId: string, max: number) {
  if (executionsState.userId !== userId) {
    executionsState.unsub?.();
    executionsState.unsub = null;
    executionsState.data = [];
    executionsState.loading = true;
    executionsState.error = null;
    executionsState.userId = userId;
    executionsState.refCount = 0;
  }

  executionsState.refCount++;

  if (executionsState.unsub) return;

  const q = query(
    collection(getFirestore(), "executions"),
    where("userId", "==", userId),
    orderBy("startedAt", "desc"),
    qLimit(max)
  );

  executionsState.unsub = onSnapshot(
    q,
    (snap) => {
      executionsState.data = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Execution
      );
      executionsState.loading = false;
      executionsState.error = null;
      emit();
    },
    (err) => {
      executionsState.loading = false;
      executionsState.error = err;
      emit();
    }
  );
}

function stopExecutions() {
  executionsState.refCount = Math.max(0, executionsState.refCount - 1);
  if (executionsState.refCount === 0 && executionsState.unsub) {
    executionsState.unsub();
    executionsState.unsub = null;
  }
}

export function invalidateDashboardCache() {
  workflowsState.unsub?.();
  executionsState.unsub?.();
  workflowsState.unsub = null;
  executionsState.unsub = null;
  workflowsState.userId = null;
  executionsState.userId = null;
  workflowsState.data = [];
  executionsState.data = [];
  workflowsState.loading = true;
  executionsState.loading = true;
  emit();
}

export function addWorkflowsToCache(items: Workflow[]) {
  if (items.length === 0) return;
  workflowsState.data = [...items, ...workflowsState.data];
  emit();
}

export function removeWorkflowFromCache(id: string) {
  workflowsState.data = workflowsState.data.filter((w) => w.id !== id);
  emit();
}

export function patchWorkflowInCache(id: string, patch: Partial<Workflow>) {
  workflowsState.data = workflowsState.data.map((w) =>
    w.id === id ? { ...w, ...patch } : w
  );
  emit();
}

export function useWorkflows(userId: string | undefined) {
  const data = useSyncExternalStore(
    subscribeStore,
    getWorkflowsSnapshot,
    () => workflowsState.data
  );

  useEffect(() => {
    if (!userId) return;
    startWorkflows(userId);
    return () => {
      stopWorkflows();
    };
  }, [userId]);

  return {
    data,
    loading: userId ? workflowsState.loading : true,
    error: workflowsState.error,
  };
}

export function useExecutions(userId: string | undefined, max = 200) {
  const data = useSyncExternalStore(
    subscribeStore,
    getExecutionsSnapshot,
    () => executionsState.data
  );

  useEffect(() => {
    if (!userId) return;
    startExecutions(userId, max);
    return () => {
      stopExecutions();
    };
  }, [userId, max]);

  return {
    data,
    loading: userId ? executionsState.loading : true,
    error: executionsState.error,
  };
}
