"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` on import, so the map renders only in the browser.
export const IssueMapLazy = dynamic(() => import("./issue-map"), {
  ssr: false,
  loading: () => <div style={{ height: "100%" }} />,
});
