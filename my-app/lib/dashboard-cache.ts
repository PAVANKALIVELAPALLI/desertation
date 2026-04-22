"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getUserExecutions, getUserWorkflows } from "./firestore";
import type { Execution, Workflow } from "@/types/workflow";

type Snapshot<T> = { data: T; at: number; userId: string };

const TTL_MS = 30_000;
const EMPTY_WORKFLOWS: readonly Workflow[] = Object.freeze([]);
const EMPTY_EXECUTIONS: readonly Execution[] = Object.freeze([]);

const state = {
  workflows: null as Snapshot<Workflow[]> | null,
  executions: null as Snapshot<Execution[]> | null,
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach((l) => l());
}

function isFresh<T>(snap: Snapshot<T> | null, userId: string | undefined): boolean {
  if (!snap) return false;
  if (userId && snap.userId !== userId) return false;
  return Date.now() - snap.at <= TTL_MS;
}

function getWorkflows(): readonly Workflow[] {
  return state.workflows?.data ?? EMPTY_WORKFLOWS;
}

function getExecutions(): readonly Execution[] {
  return state.executions?.data ?? EMPTY_EXECUTIONS;
}

export function invalidateDashboardCache() {
  state.workflows = null;
  state.executions = null;
  emit();
}

export function addWorkflowsToCache(items: Workflow[]) {
  if (!state.workflows) return;
  state.workflows = {
    ...state.workflows,
    data: [...items, ...state.workflows.data],
    at: Date.now(),
  };
  emit();
}

export function removeWorkflowFromCache(id: string) {
  if (!state.workflows) return;
  state.workflows = {
    ...state.workflows,
    data: state.workflows.data.filter((w) => w.id !== id),
    at: Date.now(),
  };
  emit();
}

export function patchWorkflowInCache(id: string, patch: Partial<Workflow>) {
  if (!state.workflows) return;
  state.workflows = {
    ...state.workflows,
    data: state.workflows.data.map((w) =>
      w.id === id ? { ...w, ...patch } : w
    ),
    at: Date.now(),
  };
  emit();
}

export function useWorkflows(userId: string | undefined) {
  const data = useSyncExternalStore(subscribe, getWorkflows, () => EMPTY_WORKFLOWS);
  const loading = state.workflows === null;

  useEffect(() => {
    if (!userId) return;
    if (isFresh(state.workflows, userId)) return;

    let alive = true;
    getUserWorkflows(userId)
      .then((rows) => {
        if (!alive) return;
        state.workflows = { data: rows, at: Date.now(), userId };
        emit();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  return { data: data as Workflow[], loading };
}

export function useExecutions(userId: string | undefined, max = 200) {
  const data = useSyncExternalStore(subscribe, getExecutions, () => EMPTY_EXECUTIONS);
  const loading = state.executions === null;

  useEffect(() => {
    if (!userId) return;
    if (isFresh(state.executions, userId)) return;

    let alive = true;
    getUserExecutions(userId, max)
      .then((rows) => {
        if (!alive) return;
        state.executions = { data: rows, at: Date.now(), userId };
        emit();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, max]);

  return { data: data as Execution[], loading };
}
