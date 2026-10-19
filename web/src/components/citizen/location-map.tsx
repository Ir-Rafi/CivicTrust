"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { useEffect, useRef } from "react";
import type { GpsQuality } from "@/lib/geo";

// Quality colours: the app's success / warning / error tokens (SVG attributes cannot read CSS variables).
const QUALITY_COLOR: Record<GpsQuality | "demo", string> = {
  good: "#1e6c41",
  fair: "#c27c0e",
  poor: "#b3261e",
  demo: "#6750a4",
};

const DEMO_ZOOM = 17;
const MAX_FIT_ZOOM = 18;

// A "you are here" dot with a soft pulse; styled in globals.css (.loc-pin).
const pinIcon = (tone: GpsQuality | "demo") =>
  L.divIcon({
    className: "",
    html: `<span class="loc-pin" style="--pin:${QUALITY_COLOR[tone]}"><span class="loc-pin-pulse"></span><span class="loc-pin-dot"></span></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

/** Zooms so the whole accuracy circle is visible (or to street level for demo spots). */
function fitTo(map: L.Map, lat: number, lng: number, accuracyM: number | null) {
  if (accuracyM === null) map.setView([lat, lng], DEMO_ZOOM);
  else map.fitBounds(L.latLng(lat, lng).toBounds(accuracyM * 2), { maxZoom: MAX_FIT_ZOOM, padding: [28, 28] });
}

export type LocationMapProps = {
  lat: number;
  lng: number;
  /** GPS accuracy radius in metres; null for a chosen demo spot. */
  accuracyM: number | null;
  quality: GpsQuality | null;
  /** Shown on the map, e.g. "±১২ মিটার" or "ডেমো অবস্থান". */
  badge: string;
  recenterLabel: string;
};

/**
 * Preview of where the report will be filed. Plain Leaflet owned by effects, like the officer
 * map: Cache Components keeps visited pages mounted but hidden (React <Activity>), which runs
 * effect cleanups on hide and the effects again on show. react-leaflet's MapContainer never
 * rebuilds its map after that, so the map is created in a fresh element each time it is shown.
 */
export default function LocationMap({ lat, lng, accuracyM, quality, badge, recenterLabel }: LocationMapProps) {
  const tone = quality ?? "demo";
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.style.height = "100%";
    el.style.width = "100%";
    hostRef.current!.appendChild(el);
    const map = L.map(el, { maxZoom: 19, scrollWheelZoom: false, dragging: false, doubleClickZoom: false });
    // Standard OpenStreetMap tiles: no API key, same source as the officer map.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      mapRef.current = null;
      layerRef.current = null;
      map.remove();
      el.remove();
    };
  }, []);

  // Declared after the map effect so it runs after it: on mount, on every new fix, and when the
  // page is shown again.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const color = QUALITY_COLOR[tone];
    if (accuracyM !== null) {
      L.circle([lat, lng], { radius: accuracyM, color, weight: 1.5, fillColor: color, fillOpacity: 0.12, interactive: false }).addTo(layer);
    }
    L.marker([lat, lng], { icon: pinIcon(tone), interactive: false, keyboard: false }).addTo(layer);
    fitTo(map, lat, lng, accuracyM);
  }, [lat, lng, accuracyM, tone]);

  return (
    <div className="location-map">
      <div ref={hostRef} style={{ height: "100%", width: "100%" }} />
      <span className="map-badge" style={{ color: QUALITY_COLOR[tone] }}>
        <span className="map-badge-dot" style={{ background: QUALITY_COLOR[tone] }} />
        {badge}
      </span>
      <button
        type="button"
        className="map-fab"
        onClick={() => mapRef.current && fitTo(mapRef.current, lat, lng, accuracyM)}
        aria-label={recenterLabel}
        title={recenterLabel}
      >
        <LocateFixed size={18} aria-hidden />
      </button>
    </div>
  );
}
