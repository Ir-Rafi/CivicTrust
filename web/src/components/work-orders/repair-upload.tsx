"use client";

import { Camera, Loader2, MapPin, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { uiSubmitRepair } from "@/app/actions/ui";
import { prepareImage } from "@/lib/image";
import { fill, type Dict } from "@/lib/i18n";

type Location = { state: "locating" } | { state: "gps"; lat: number; lng: number; accuracy: number } | { state: "failed" };
type Result = { verdict: "approved" | "rejected" | "needs_review"; reason: string | null; paymentStatus: "eligible" | "withheld" };

const noopSubscribe = () => () => {};

/**
 * After-photo capture for a work order. The server checks distance (15 m), freshness and capture
 * time, then Gemini compares it with the citizen's before-photo. The "work site" option is for
 * demos from a laptop; it sends the issue's own coordinates.
 */
export function RepairUpload({
  workOrderId,
  site,
  t,
}: {
  workOrderId: number;
  site: { lat: number; lng: number };
  t: Pick<Dict, "repair" | "verdict" | "errors">;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string; capturedAt: number } | null>(null);
  const [location, setLocation] = useState<Location>({ state: "locating" });
  const [useSite, setUseSite] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const geoSupported = useSyncExternalStore(noopSubscribe, () => "geolocation" in navigator, () => true);

  useEffect(() => {
    if (!geoSupported) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ state: "gps", lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => setLocation({ state: "failed" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, [geoSupported]);
  const gps: Location = geoSupported ? location : { state: "failed" };

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.preview);
  }, [photo]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setResult(null);
    try {
      const blob = await prepareImage(file);
      setPhoto({ blob, preview: URL.createObjectURL(blob), capturedAt: file.lastModified || Date.now() });
    } catch {
      setError(t.errors.badFile);
    }
  }

  async function submit() {
    if (!photo) return setError(t.repair.needPhoto);
    const coords = useSite ? site : gps.state === "gps" ? gps : null;
    if (!coords) return setError(t.repair.needLocation);
    const fd = new FormData();
    fd.set("photo", new File([photo.blob], "repair.jpg", { type: "image/jpeg" }));
    fd.set("workOrderId", String(workOrderId));
    fd.set("lat", String(coords.lat));
    fd.set("lng", String(coords.lng));
    fd.set("capturedAt", new Date(photo.capturedAt).toISOString());
    setError(null);
    setPending(true);
    let res: Awaited<ReturnType<typeof uiSubmitRepair>>;
    try {
      res = await uiSubmitRepair(fd);
    } catch {
      res = { ok: false, error: t.errors.generic };
    } finally {
      setPending(false);
    }
    if (!res.ok) return setError(res.error);
    setResult(res.data);
    setPhoto(null);
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div>
        <div className="title-medium">{t.repair.uploadTitle}</div>
        <p className="body-medium" style={{ fontSize: "0.85rem", marginTop: 4 }}>
          {t.repair.uploadHelp}
        </p>
      </div>

      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onFile} className="hidden" />
      {photo ? (
        <div className="stack" style={{ gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img src={photo.preview} alt="" className="photo" style={{ maxHeight: 280 }} />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={pending} className="btn btn-tonal btn-sm" style={{ alignSelf: "flex-start" }}>
            <RotateCcw size={14} aria-hidden /> {t.repair.retake}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => fileInput.current?.click()} className="capture-box">
          <Camera size={30} aria-hidden />
          <span className="title-medium" style={{ color: "var(--md-primary)" }}>
            {t.repair.takePhoto}
          </span>
        </button>
      )}

      <div>
        {!useSite && (
          <p className="body-medium" style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6 }}>
            <MapPin size={14} aria-hidden />
            {gps.state === "locating" && t.repair.locating}
            {gps.state === "gps" && fill(t.repair.locationGps, { m: String(Math.round(gps.accuracy)) })}
            {gps.state === "failed" && t.repair.gpsFailed}
          </p>
        )}
        <label className="body-medium" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", marginTop: 6 }}>
          <input type="checkbox" checked={useSite} onChange={(e) => setUseSite(e.target.checked)} />
          {t.repair.useSite}
        </label>
      </div>

      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}

      <button type="button" className="btn btn-filled btn-block" disabled={pending} onClick={submit}>
        {pending ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden /> {t.repair.checking}
          </>
        ) : (
          t.repair.submit
        )}
      </button>

      {result && (
        <div className={`notice ${result.verdict === "approved" ? "success" : result.verdict === "rejected" ? "error" : "warning"}`} role="status">
          <span>
            <strong>
              {t.repair.result}: {t.verdict[result.verdict]}
            </strong>
            {result.reason && (
              <span style={{ display: "block", marginTop: 2 }} lang="en">
                {result.reason}
              </span>
            )}
            <span className="label-small" style={{ display: "block", marginTop: 4 }}>
              {result.paymentStatus === "eligible" ? t.repair.gateEligible : t.repair.gateWithheld}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
