"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function useUrlId(prefix: string): string | undefined {
  const pathname = usePathname();
  const [id, setId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return extractId(window.location.pathname, prefix);
  });

  useEffect(() => {
    const fromPath = extractId(pathname || "", prefix);
    const fromLocation =
      typeof window !== "undefined"
        ? extractId(window.location.pathname, prefix)
        : undefined;
    setId(fromLocation || fromPath);
  }, [pathname, prefix]);

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
