"use client";

import { Camera, Loader2, MapPin, RotateCcw } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { submitReport, type ReportFormState } from "@/app/citizen/actions";
import { prepareImage } from "@/lib/image";
import { fill, type Dict, type Lang } from "@/lib/i18n";

// Real roads in the Dhanmondi pilot area, for testing from a laptop without GPS.
// Reports using them are recorded with location source "demo".
const DEMO_SPOTS = [
  { id: "lane", en: "Residential lane near Academia school", bn: "একাডেমিয়া স্কুলের কাছে আবাসিক রাস্তা", lat: 23.7465, lng: 90.374 },
  { id: "green", en: "Green Road", bn: "গ্রিন রোড", lat: 23.74563, lng: 90.38526 },
  { id: "panthapath", en: "Panthapath", bn: "পান্থপথ", lat: 23.75287, lng: 90.38275 },
  { id: "road16", en: "Road 16", bn: "রোড ১৬", lat: 23.75409, lng: 90.37135 },
] as const;

type Location =
  | { state: "locating" }
  | { state: "gps"; lat: number; lng: number; accuracy: number }
  | { state: "failed" };

const noopSubscribe = () => () => {};

export function ReportForm({ t, lang }: { t: Pick<Dict, "citizen" | "errors">; lang: Lang }) {
  const [state, formAction, pending] = useActionState<ReportFormState, FormData>(submitReport, null);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string; capturedAt: number } | null>(null);
  const [location, setLocation] = useState<Location>({ state: "locating" });
  const [useDemo, setUseDemo] = useState(false);
  const [demoSpot, setDemoSpot] = useState<string>(DEMO_SPOTS[0].id);
  const [clientError, setClientError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const geoSupported = useSyncExternalStore(
    noopSubscribe,
    () => "geolocation" in navigator,
    () => true,
  );

  function requestGps() {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setLocation({ state: "gps", lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => setLocation({ state: "failed" }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  useEffect(() => {
    if (geoSupported) requestGps();
  }, [geoSupported]);
  const gps: Location = geoSupported ? location : { state: "failed" };

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.preview);
  }, [photo]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setClientError(null);
    try {
      const blob = await prepareImage(file);
      // lastModified of a fresh camera capture is "now"; an old gallery photo is caught by the server.
      setPhoto({ blob, preview: URL.createObjectURL(blob), capturedAt: file.lastModified || Date.now() });
    } catch {
      setClientError(t.errors.badFile);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) return setClientError(t.citizen.needPhoto);
    const spot = DEMO_SPOTS.find((s) => s.id === demoSpot)!;
    const coords =
      useDemo || gps.state !== "gps"
        ? useDemo
          ? { lat: spot.lat, lng: spot.lng, accuracy: "", source: "demo" }
          : null
        : { lat: gps.lat, lng: gps.lng, accuracy: String(gps.accuracy), source: "gps" };
    if (!coords) return setClientError(gps.state === "failed" ? t.citizen.gpsHelp : t.citizen.needLocation);

    const fd = new FormData();
    fd.set("photo", new File([photo.blob], "report.jpg", { type: "image/jpeg" }));
    fd.set("lat", String(coords.lat));
    fd.set("lng", String(coords.lng));
    fd.set("accuracy", coords.accuracy);
    fd.set("capturedAt", new Date(photo.capturedAt).toISOString());
    fd.set("locationSource", coords.source);
    setClientError(null);
    startTransition(() => formAction(fd));
  }

  const serverError =
    state?.error === "too_old"
      ? t.errors.tooOld
      : state?.error === "bad_file"
        ? t.errors.badFile
        : state?.error === "not_civic"
          ? t.errors.rejected
          : state?.error === "generic"
            ? t.errors.generic
            : null;
  const error = clientError ?? serverError;

  return (
    <form onSubmit={onSubmit} className="card">
      <div className="card-head">
        <h1 className="headline-small">{t.citizen.title}</h1>
        <span className="tag moderate">{t.citizen.pilotTag}</span>
      </div>
      <p className="body-medium" style={{ marginBottom: 20 }}>
        {t.citizen.intro}
      </p>

      {/* Photo */}
      <div style={{ marginBottom: 20 }}>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={onFile}
          className="hidden"
        />
        {photo ? (
          <div className="stack" style={{ gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={photo.preview} alt="" className="photo" style={{ maxHeight: 320 }} />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={pending}
              className="btn btn-tonal btn-sm"
              style={{ alignSelf: "flex-start" }}
            >
              <RotateCcw size={14} aria-hidden /> {t.citizen.retake}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => fileInput.current?.click()} className="capture-box">
            <Camera size={32} aria-hidden />
            <span className="title-medium" style={{ color: "var(--md-primary)" }}>
              {t.citizen.takePhoto}
            </span>
            <span className="label-small">{t.citizen.photoHint}</span>
          </button>
        )}
      </div>

      {/* Location */}
      <fieldset style={{ marginBottom: 20 }}>
        <legend className="input-field-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <MapPin size={14} aria-hidden /> {t.citizen.location}
        </legend>
        {!useDemo && (
          <p className="body-medium" style={{ fontSize: "0.85rem" }}>
            {gps.state === "locating" && t.citizen.locating}
            {gps.state === "gps" && fill(t.citizen.gpsOk, { m: String(Math.round(gps.accuracy)) })}
            {gps.state === "failed" && t.citizen.gpsFailed}
          </p>
        )}
        {!useDemo && gps.state === "failed" && geoSupported && (
          <button
            type="button"
            onClick={() => {
              setLocation({ state: "locating" });
              requestGps();
            }}
            className="text-link"
            style={{ fontSize: "0.85rem", background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            {t.citizen.retryGps}
          </button>
        )}
        <label className="body-medium" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", marginTop: 8 }}>
          <input type="checkbox" checked={useDemo} onChange={(e) => setUseDemo(e.target.checked)} />
          {t.citizen.useDemo}
        </label>
        {useDemo && (
          <div className="input-field-group" style={{ marginTop: 12, marginBottom: 0 }}>
            <label className="input-field-label" htmlFor="demo-spot">
              {t.citizen.demoLabel}
            </label>
            <select id="demo-spot" value={demoSpot} onChange={(e) => setDemoSpot(e.target.value)} className="input-filled">
              {DEMO_SPOTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s[lang]}
                </option>
              ))}
            </select>
            <p className="label-small" style={{ paddingLeft: 4 }}>
              {t.citizen.demoNote}
            </p>
          </div>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="notice error" style={{ marginBottom: 16 }}>
          <span>
            {error}
            {state?.error === "not_civic" && state.detail ? (
              <span className="label-small" style={{ display: "block" }}>
                {state.detail}
              </span>
            ) : null}
          </span>
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-filled btn-block">
        {pending ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden /> {t.citizen.analysing}
          </>
        ) : (
          t.citizen.submit
        )}
      </button>
    </form>
  );
}
