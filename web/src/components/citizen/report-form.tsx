"use client";

import { Camera, Loader2, MapPin, RotateCcw } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { describeLocation, submitReport, type ReportFormState } from "@/app/citizen/actions";
import { LocationMapLazy } from "@/components/citizen/location-map-lazy";
import { DUPLICATE_RADIUS_M, GPS_REFINE_MS, GPS_TARGET_ACCURACY_M, gpsQuality } from "@/lib/geo";
import { prepareImage } from "@/lib/image";
import { fill, num, type Dict, type Lang } from "@/lib/i18n";
import type { PlaceDescription } from "@/lib/location";
import { roadClassLabel } from "@/lib/severity";

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
  /** refining: still listening for a more accurate fix. */
  | { state: "gps"; lat: number; lng: number; accuracy: number; refining: boolean }
  | { state: "failed" };

const noopSubscribe = () => () => {};

export function ReportForm({ t, lang }: { t: Pick<Dict, "citizen" | "errors">; lang: Lang }) {
  const [state, formAction, pending] = useActionState<ReportFormState, FormData>(submitReport, null);
  const [photo, setPhoto] = useState<{ blob: Blob; preview: string; capturedAt: number } | null>(null);
  const [location, setLocation] = useState<Location>({ state: "locating" });
  const [useDemo, setUseDemo] = useState(false);
  const [demoSpot, setDemoSpot] = useState<string>(DEMO_SPOTS[0].id);
  const [clientError, setClientError] = useState<string | null>(null);
  const [place, setPlace] = useState<{ key: string; value: PlaceDescription | null } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const watchId = useRef<number | null>(null);
  const watchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const geoSupported = useSyncExternalStore(
    noopSubscribe,
    () => "geolocation" in navigator,
    () => true,
  );

  function clearWatch() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (watchTimer.current !== null) clearTimeout(watchTimer.current);
    watchId.current = null;
    watchTimer.current = null;
  }

  function stopGps() {
    clearWatch();
    setLocation((prev) => (prev.state === "gps" ? { ...prev, refining: false } : prev));
  }

  /**
   * Phones often start with a coarse fix (cell/Wi-Fi) and tighten as satellites lock, so keep
   * listening for a while and keep the most accurate reading. Stops early once the fix is as
   * tight as the repair check needs. fresh: ignore cached positions ("Refresh location").
   */
  function requestGps(fresh = false) {
    clearWatch();
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const done = accuracy <= GPS_TARGET_ACCURACY_M;
        setLocation((prev) =>
          prev.state === "gps" && prev.accuracy <= accuracy
            ? { ...prev, refining: prev.refining && !done }
            : { state: "gps", lat, lng, accuracy, refining: !done },
        );
        if (done) stopGps();
      },
      () => {
        setLocation((prev) => (prev.state === "gps" ? { ...prev, refining: false } : { state: "failed" }));
        clearWatch();
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: fresh ? 0 : 60000 },
    );
    watchTimer.current = setTimeout(stopGps, GPS_REFINE_MS);
  }

  useEffect(() => {
    if (geoSupported) requestGps();
    return clearWatch;
    // Start listening once when the page opens; requestGps only touches refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoSupported]);
  const gps: Location = geoSupported ? location : { state: "failed" };

  // The point the report will be filed at, shown on the map and described in words.
  const spot = DEMO_SPOTS.find((s) => s.id === demoSpot)!;
  const point = useDemo
    ? { lat: spot.lat, lng: spot.lng, accuracy: null }
    : gps.state === "gps"
      ? { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy }
      : null;
  // ~11 m grid: refining GPS fixes do not trigger a lookup for every small move.
  const pointKey = point ? `${point.lat.toFixed(4)},${point.lng.toFixed(4)}` : null;
  useEffect(() => {
    if (!point || !pointKey) return;
    let live = true;
    describeLocation({ lat: point.lat, lng: point.lng }).then((value) => {
      if (live) setPlace({ key: pointKey, value });
    });
    return () => {
      live = false;
    };
    // pointKey captures the point; the object itself is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey]);
  const placeHere = place && place.key === pointKey ? place : null;
  const placeRoad = placeHere?.value?.road;
  const placeMain = !placeHere ? t.citizen.placeLoading : placeRoad ? (placeRoad.name ?? roadClassLabel(placeRoad.highway, lang)) : t.citizen.outsidePilot;
  const placeNear = placeRoad && placeHere?.value?.landmark ? fill(t.citizen.near, { name: placeHere.value.landmark.name }) : null;
  const quality = !useDemo && gps.state === "gps" ? gpsQuality(gps.accuracy) : null;
  const roughGps = gps.state === "gps" && !gps.refining && quality === "poor";

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
          <p className="body-medium" style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6 }}>
            {(gps.state === "locating" || (gps.state === "gps" && gps.refining)) && (
              <Loader2 size={14} className="animate-spin" aria-hidden style={{ color: "var(--md-primary)" }} />
            )}
            {gps.state === "locating" && t.citizen.locating}
            {gps.state === "gps" &&
              fill(gps.refining ? t.citizen.gpsRefining : t.citizen.gpsOk, { m: num(Math.round(gps.accuracy), lang) })}
            {gps.state === "failed" && t.citizen.gpsFailed}
          </p>
        )}
        {point && (
          <div style={{ marginTop: 10 }}>
            <LocationMapLazy
              lat={point.lat}
              lng={point.lng}
              accuracyM={point.accuracy}
              quality={quality}
              badge={point.accuracy === null ? t.citizen.demoBadge : fill(t.citizen.accuracyBadge, { m: num(Math.round(point.accuracy), lang) })}
              recenterLabel={t.citizen.recenter}
            />
            <p className="place-line" aria-live="polite">
              <MapPin size={18} aria-hidden style={{ flexShrink: 0, color: "var(--md-primary)", marginTop: 2 }} />
              <span>
                <strong>{placeMain}</strong>
                {placeNear && (
                  <span className="label-small" style={{ display: "block" }}>
                    {placeNear}
                  </span>
                )}
              </span>
            </p>
          </div>
        )}
        {roughGps && gps.state === "gps" && (
          <p className="notice warning" style={{ marginTop: 8, fontSize: "0.85rem" }}>
            <span>
              {fill(t.citizen.gpsRough, { m: num(Math.round(gps.accuracy), lang), r: num(DUPLICATE_RADIUS_M, lang) })}{" "}
              <button
                type="button"
                onClick={() => {
                  setLocation({ state: "locating" });
                  requestGps(true);
                }}
                className="text-link"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
              >
                {t.citizen.refreshGps}
              </button>
            </span>
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
