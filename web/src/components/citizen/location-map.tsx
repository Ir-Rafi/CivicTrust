"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LocateFixed } from "lucide-react";
import { useEffect, useRef } from "react";
import { PILOT_BOUNDS, type GpsQuality } from "@/lib/geo";

type Tone = GpsQuality | "demo" | "pin";

// Quality colours: the app's success / warning / error tokens (SVG attributes cannot read CSS variables).
const TONE_COLOR: Record<Tone, string> = {
  good: "#1e6c41",
  fair: "#c27c0e",
  poor: "#b3261e",
  demo: "#6750a4",
  pin: "#6750a4",
};

const STREET_ZOOM = 17;
const MAX_FIT_ZOOM = 18;
const PILOT_LATLNG_BOUNDS = L.latLngBounds([PILOT_BOUNDS.south, PILOT_BOUNDS.west], [PILOT_BOUNDS.north, PILOT_BOUNDS.east]);

// A "you are here" dot with a soft pulse; styled in globals.css (.loc-pin).
const pinIcon = (tone: Tone) =>
  L.divIcon({
    className: "",
    html: `<span class="loc-pin" style="--pin:${TONE_COLOR[tone]}"><span class="loc-pin-pulse"></span><span class="loc-pin-dot"></span></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

type Point = { lat: number; lng: number };

/** Zooms to the accuracy circle, to street level for an exact point, or to the pilot area when there is no point. */
function fitTo(map: L.Map, point: Point | null, accuracyM: number | null) {
  if (!point) map.fitBounds(PILOT_LATLNG_BOUNDS, { padding: [12, 12] });
  else if (accuracyM === null) map.setView([point.lat, point.lng], Math.max(map.getZoom() || 0, STREET_ZOOM));
  else map.fitBounds(L.latLng(point.lat, point.lng).toBounds(accuracyM * 2), { maxZoom: MAX_FIT_ZOOM, padding: [28, 28] });
}

export type LocationMapProps = {
  /** null: no location yet (GPS pending or failed); the map shows the pilot area to pick from. */
  point: Point | null;
  /** GPS accuracy radius in metres; null for an exact point (demo spot or placed pin). */
  accuracyM: number | null;
  quality: GpsQuality | null;
  /** The citizen placed the point: the view stays where they are working. */
  pinned: boolean;
  /** Manual selection: tap or drag to choose the exact spot. Omitted outside manual mode. */
  onPick?: (lat: number, lng: number) => void;
  badge: string | null;
  recenterLabel: string;
};

/**
 * Where the report will be filed. GPS places the pin; the citizen can tap the map or drag the pin
 * to the exact spot. Plain Leaflet owned by effects, like the officer map: Cache Components keeps
 * visited pages mounted but hidden (React <Activity>), so the map is rebuilt each time it is shown.
 */
export default function LocationMap({ point, accuracyM, quality, pinned, onPick, badge, recenterLabel }: LocationMapProps) {
  const tone: Tone = pinned ? "pin" : (quality ?? "demo");
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  });

  useEffect(() => {
    const el = document.createElement("div");
    el.style.height = "100%";
    el.style.width = "100%";
    hostRef.current!.appendChild(el);
    const map = L.map(el, { maxZoom: 19, scrollWheelZoom: false, doubleClickZoom: false });
    // Also initialise the view when React restores an already-selected pin.
    fitTo(map, null, null);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    // Where pins may be placed.
    L.rectangle(PILOT_LATLNG_BOUNDS, { color: "#6750a4", weight: 1.5, dashArray: "6 6", fill: false, interactive: false }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      mapRef.current = null;
      layerRef.current = null;
      map.remove();
      el.remove();
    };
  }, []);

  const lat = point?.lat ?? null;
  const lng = point?.lng ?? null;
  const pickable = !!onPick;
  // Declared after the map effect so it runs after it: on mount, on every new point, and when shown again.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const here = lat !== null && lng !== null ? { lat, lng } : null;
    if (here) {
      const color = TONE_COLOR[tone];
      if (accuracyM !== null) {
        L.circle([here.lat, here.lng], { radius: accuracyM, color, weight: 1.5, fillColor: color, fillOpacity: 0.12, interactive: false }).addTo(layer);
      }
      const marker = L.marker([here.lat, here.lng], { icon: pinIcon(tone), draggable: pickable, keyboard: false, interactive: pickable }).addTo(layer);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onPickRef.current?.(p.lat, p.lng);
      });
    }
    // A placed pin keeps the view the citizen is working in; GPS fixes and demo spots refit it.
    if (!pinned) fitTo(map, here, accuracyM);
    else if (here && !map.getBounds().contains([here.lat, here.lng])) map.panTo([here.lat, here.lng]);
  }, [lat, lng, accuracyM, tone, pinned, pickable]);

  return (
    <div className="location-map">
      <div ref={hostRef} style={{ height: "100%", width: "100%", cursor: pickable ? "crosshair" : undefined }} />
      {badge && (
        <span className="map-badge" style={{ color: TONE_COLOR[tone] }}>
          <span className="map-badge-dot" style={{ background: TONE_COLOR[tone] }} />
          {badge}
        </span>
      )}
      {point && (
        <button
          type="button"
          className="map-fab"
          onClick={() => mapRef.current && fitTo(mapRef.current, point, accuracyM)}
          aria-label={recenterLabel}
          title={recenterLabel}
        >
          <LocateFixed size={18} aria-hidden />
        </button>
      )}
    </div>
  );
}
