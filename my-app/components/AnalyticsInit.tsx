"use client";

import { useEffect } from "react";
import { getAnalytics } from "firebase/analytics";
import { app } from "@/lib/firebase";

export function AnalyticsInit() {
  useEffect(() => {
    getAnalytics(app);
  }, []);
  return null;
}
