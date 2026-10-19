"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef } from "react";

export type MapPoint = { id: number; lat: number; lng: number; severity: number; label: string };

const PILOT_CENTER: [number, number] = [23.7475, 90.3775];

function color(severity: number) {
  if (severity >= 8) return "#B3261E";
  if (severity >= 5) return "#7D5260";
  return "#1E6C41";
}

/**
 * Plain Leaflet, owned by one effect. Cache Components keeps visited pages mounted but hidden
 * (React <Activity>), which runs effect cleanups on hide and re-runs effects on show.
 * react-leaflet's MapContainer removes its map on hide and never rebuilds it, so the map is
 * created here in a fresh element each time the page becomes visible and removed when hidden.
 */
export default function IssueMap({ points, selectedId }: { points: MapPoint[]; selectedId: number | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const hostRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const select = useEffectEvent((id: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("issue", String(id));
    router.push(`/officer?${next.toString()}`, { scroll: false });
  });

  useEffect(() => {
    const el = document.createElement("div");
    el.style.height = "100%";
    el.style.width = "100%";
    hostRef.current!.appendChild(el);
    const map = L.map(el, { center: PILOT_CENTER, zoom: 15, scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      layerRef.current = null;
      map.remove();
      el.remove();
    };
  }, []);

  // Declared after the map effect so it runs after it, on mount and whenever the page is shown again.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const p of points) {
      const selected = p.id === selectedId;
      // Text node, not an HTML string: Leaflet would insert a string as HTML.
      const label = document.createElement("span");
      label.textContent = p.label;
      L.circleMarker([p.lat, p.lng], {
        radius: selected ? 11 : 7 + p.severity * 0.3,
        color: selected ? "#21005D" : "#FFFFFF",
        weight: selected ? 3 : 1.5,
        fillColor: color(p.severity),
        fillOpacity: 0.9,
      })
        .bindTooltip(label, { direction: "top" })
        .on("click", () => select(p.id))
        .addTo(layer);
    }
  }, [points, selectedId]);

  return <div ref={hostRef} style={{ height: "100%", width: "100%" }} />;
}
