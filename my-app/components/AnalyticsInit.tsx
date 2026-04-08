"use client";

import { useEffect } from "react";

export function AnalyticsInit() {
  useEffect(() => {
    import("firebase/analytics").then(({ getAnalytics, isSupported }) => {
      isSupported().then((yes) => {
        if (yes) {
          import("@/lib/firebase").then(({ getFirebaseApp }) => {
            getFirebaseApp().then((app) => {
              getAnalytics(app);
            });
          });
        }
      });
    });
  }, []);
  return null;
}
