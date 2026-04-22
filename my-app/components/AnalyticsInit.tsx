"use client";

import { useEffect } from "react";
import { getFirebaseApp } from "@/lib/firebase";

export function AnalyticsInit() {
  useEffect(() => {
    import("firebase/analytics").then(({ getAnalytics, isSupported }) => {
      isSupported().then((yes) => {
        if (yes) getAnalytics(getFirebaseApp());
      });
    });
  }, []);
  return null;
}
