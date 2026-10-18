"use client";

import "leaflet/dist/leaflet.css";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";

export type MapPoint = { id: number; lat: number; lng: number; severity: number; label: string };

const PILOT_CENTER: [number, number] = [23.7475, 90.3775];

function color(severity: number) {
  if (severity >= 8) return "#B3261E";
  if (severity >= 5) return "#7D5260";
  return "#1E6C41";
}

export default function IssueMap({ points, selectedId }: { points: MapPoint[]; selectedId: number | null }) {
  const router = useRouter();
  const params = useSearchParams();

  function select(id: number) {
    const next = new URLSearchParams(params.toString());
    next.set("issue", String(id));
    router.push(`/officer?${next.toString()}`, { scroll: false });
  }

  return (
    <MapContainer center={PILOT_CENTER} zoom={15} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => {
        const selected = p.id === selectedId;
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={selected ? 11 : 7 + p.severity * 0.3}
            pathOptions={{
              color: selected ? "#21005D" : "#FFFFFF",
              weight: selected ? 3 : 1.5,
              fillColor: color(p.severity),
              fillOpacity: 0.9,
            }}
            eventHandlers={{ click: () => select(p.id) }}
          >
            <Tooltip direction="top">{p.label}</Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
