"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

function subscribeToLocation(notify: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", notify);
  return () => {
    window.removeEventListener("popstate", notify);
  };
}

function getLocationPath(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

export function useUrlId(prefix: string): string | undefined {
  const pathname = usePathname();
  const locationPath = useSyncExternalStore(
    subscribeToLocation,
    getLocationPath,
    () => "",
  );
  const fromLocation = extractId(locationPath, prefix);
  const fromPath = extractId(pathname || "", prefix);
  const id = fromLocation || fromPath;
  return id && id !== "_" ? id : undefined;
}

function extractId(path: string, prefix: string): string | undefined {
  const normalized = path.replace(/\/+$/, "");
  if (!normalized.startsWith(prefix)) return undefined;
  const rest = normalized.slice(prefix.length);
  if (!rest.startsWith("/")) return undefined;
  const segment = rest.slice(1).split("/")[0];
  return segment || undefined;
}
