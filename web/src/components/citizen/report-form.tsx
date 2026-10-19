"use client";

import { Camera, Loader2, MapPin, RotateCcw } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { describeLocation, submitReport, type ReportFormState } from "@/app/citizen/actions";
import { LocationMapLazy } from "@/components/citizen/location-map-lazy";
import { DUPLICATE_RADIUS_M, GPS_REFINE_MS, GPS_TARGET_ACCURACY_M, googleMapsUrl, gpsQuality, insidePilot } from "@/lib/geo";
import { prepareImage } from "@/lib/image";
import { fill, num, type Dict, type Lang } from "@/lib/i18n";
import type { PlaceDescription } from "@/lib/location";
import { placeLines } from "@/lib/place-name";
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
  // Manual selection: the alternative to GPS when the fix isn't exact (indoors, laptop).
  const [manual, setManual] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
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
   * tight as the repair check needs. Only fresh readings: a cached position (possibly from
   * somewhere else) could otherwise win as "the most accurate".
   */
  function requestGps() {
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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
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
  const manualOn = manual && !useDemo;
  const pinned = manualOn && pin !== null;
  const point = useDemo
    ? { lat: spot.lat, lng: spot.lng, accuracy: null }
    : manualOn
      ? pin ? { lat: pin.lat, lng: pin.lng, accuracy: null } : null
      : gps.state === "gps"
        ? { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy }
        : null;

  function startManual() {
    // Start from the GPS fix if there is one inside the pilot area; the citizen then taps or drags.
    setPin(gps.state === "gps" && insidePilot(gps.lat, gps.lng) ? { lat: gps.lat, lng: gps.lng } : null);
    setPickError(null);
    setManual(true);
  }

  function pick(lat: number, lng: number) {
    if (!insidePilot(lat, lng)) return setPickError(t.citizen.pickOutside);
    setPickError(null);
    setPin({ lat, lng });
  }
  // ~11 m grid: refining GPS fixes do not trigger a lookup for every small move. Language is part
  // of the key because place names come back in the UI language.
  const pointKey = point ? `${point.lat.toFixed(4)},${point.lng.toFixed(4)},${lang}` : null;
  useEffect(() => {
    if (!point || !pointKey) return;
    let live = true;
    describeLocation({ lat: point.lat, lng: point.lng, lang }).then((value) => {
      if (live) setPlace({ key: pointKey, value });
    });
    return () => {
      live = false;
    };
    // pointKey captures the point; the object itself is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointKey]);
  const placeHere = place && place.key === pointKey ? place : null;
  const quality = !useDemo && !pinned && gps.state === "gps" ? gpsQuality(gps.accuracy) : null;
  // Main line: the road name from OpenStreetMap (house number only for a precise GPS fix), else
  // the pilot data's road; second line: area and city; then the nearest school or hospital.
  const placeValue = placeHere?.value;
  const pilotRoad = placeValue?.road ?? null;
  const named = placeLines(placeValue?.name ?? null, { includeHouse: quality === "good" || pinned });
  const pilotRoadLabel = pilotRoad ? (pilotRoad.name ?? roadClassLabel(pilotRoad.highway, lang)) : null;
  const placeMain = !placeHere
    ? t.citizen.placeLoading
    : (named.primary ?? pilotRoadLabel ?? named.secondary ?? t.citizen.outsidePilot);
  const placeArea = placeHere && (named.primary || pilotRoadLabel) ? named.secondary : null;
  const placeNear = pilotRoad && placeValue?.landmark ? fill(t.citizen.near, { name: placeValue.landmark.name }) : null;
  // Outside the pilot data the place still has a name, but the score can't use roads or schools.
  const outsidePilot = !!placeValue && !pilotRoad && placeMain !== t.citizen.outsidePilot;
  const roughGps = !manualOn && gps.state === "gps" && !gps.refining && quality === "poor";

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
    const coords = useDemo
      ? { lat: spot.lat, lng: spot.lng, accuracy: "", source: "demo" }
      : manualOn
        ? pin ? { lat: pin.lat, lng: pin.lng, accuracy: "", source: "pin" } : null
        : gps.state === "gps"
          ? { lat: gps.lat, lng: gps.lng, accuracy: String(gps.accuracy), source: "gps" }
          : null;
    if (!coords) return setClientError(manualOn ? t.citizen.pickHint : t.citizen.needLocation);

    const fd = new FormData();
    fd.set("photo", new File([photo.blob], "report.jpg", { type: "image/jpeg" }));
    fd.set("lat", String(coords.lat));
    fd.set("lng", String(coords.lng));
    fd.set("accuracy", coords.accuracy);
    fd.set("capturedAt", new Date(photo.capturedAt).toISOString());
    fd.set("locationSource", coords.source);
    // With a placed pin, the device fix goes along so the move from GPS is on record.
    if (coords.source === "pin" && gps.state === "gps") {
      fd.set("gpsLat", String(gps.lat));
      fd.set("gpsLng", String(gps.lng));
      fd.set("gpsAccuracy", String(gps.accuracy));
    }
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
          : state?.error === "ai_busy"
            ? t.errors.aiBusy
            : state?.error === "outside_area"
              ? t.errors.outsideArea
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
        {(point || manualOn) && (
          <div style={{ marginTop: 10 }}>
            <LocationMapLazy
              point={point ? { lat: point.lat, lng: point.lng } : null}
              accuracyM={point?.accuracy ?? null}
              quality={quality}
              pinned={pinned}
              onPick={manualOn ? pick : undefined}
              badge={
                useDemo
                  ? t.citizen.demoBadge
                  : pinned
                    ? t.citizen.pickBadge
                    : point?.accuracy != null
                      ? fill(t.citizen.accuracyBadge, { m: num(Math.round(point.accuracy), lang) })
                      : null
              }
              recenterLabel={t.citizen.recenter}
            />
            {manualOn && (
              <p className="body-medium" style={{ fontSize: "0.85rem", marginTop: 8 }}>
                {t.citizen.pickHint}
              </p>
            )}
            {pickError && (
              <p role="alert" className="notice error" style={{ marginTop: 8 }}>
                {pickError}
              </p>
            )}
            {point && (
            <p className="place-line" aria-live="polite">
              <MapPin size={18} aria-hidden style={{ flexShrink: 0, color: "var(--md-primary)", marginTop: 2 }} />
              <span>
                <strong>{placeMain}</strong>
                {placeArea && (
                  <span className="body-medium" style={{ display: "block", fontSize: "0.85rem" }}>
                    {placeArea}
                  </span>
                )}
                {placeNear && (
                  <span className="label-small" style={{ display: "block" }}>
                    {placeNear}
                  </span>
                )}
                {outsidePilot && (
                  <span className="label-small" style={{ display: "block" }}>
                    {t.citizen.outsidePilotNote}
                  </span>
                )}
                <a
                  href={googleMapsUrl(point.lat, point.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link"
                  style={{ display: "inline-block", marginTop: 4, fontSize: "0.85rem" }}
                >
                  {t.citizen.checkOnMaps} ↗
                </a>
              </span>
            </p>
            )}
          </div>
        )}
        {!useDemo && (
          <div style={{ marginTop: 10 }}>
            {manualOn ? (
              <button
                type="button"
                onClick={() => {
                  setManual(false);
                  setPickError(null);
                }}
                className="text-link"
                style={{ fontSize: "0.85rem", background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                {t.citizen.useGps}
              </button>
            ) : (
              <button type="button" onClick={startManual} className="btn btn-tonal btn-sm">
                <MapPin size={14} aria-hidden /> {t.citizen.pickManually}
              </button>
            )}
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
                  requestGps();
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
