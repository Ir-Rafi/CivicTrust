"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` on import, so the map renders only in the browser.
export const LocationMapLazy = dynamic(() => import("./location-map"), {
  ssr: false,
  loading: () => <div className="location-map" />,
});
