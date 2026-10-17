"use client";

import { Camera, Loader2, MapPin, RotateCcw } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { submitReport, type ReportFormState } from "@/app/citizen/actions";
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

const MAX_EDGE = 1600;
const noopSubscribe = () => () => {};

/** Downscale and re-encode in the browser: smaller upload, and the original EXIF (incl. GPS) is dropped. */
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

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
    <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <div>
        <h1 className="text-xl font-semibold">{t.citizen.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.citizen.intro}</p>
      </div>

      {/* Photo */}
      <div className="space-y-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={onFile}
          className="hidden"
        />
        {photo ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={photo.preview} alt="" className="max-h-80 w-full rounded-md object-cover" />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={pending}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent"
            >
              <RotateCcw size={16} aria-hidden /> {t.citizen.retake}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-md border-2 border-dashed border-line px-4 py-10 text-accent hover:border-accent"
          >
            <Camera size={32} aria-hidden />
            <span className="font-semibold">{t.citizen.takePhoto}</span>
          </button>
        )}
        <p className="text-xs text-muted">{t.citizen.photoHint}</p>
      </div>

      {/* Location */}
      <fieldset className="space-y-2">
        <legend className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin size={16} aria-hidden /> {t.citizen.location}
        </legend>
        {!useDemo && (
          <p className="text-sm text-muted">
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
            className="text-sm font-medium text-accent"
          >
            {t.citizen.retryGps}
          </button>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useDemo} onChange={(e) => setUseDemo(e.target.checked)} />
          {t.citizen.useDemo}
        </label>
        {useDemo && (
          <div className="space-y-1">
            <label className="block text-xs text-muted" htmlFor="demo-spot">
              {t.citizen.demoLabel}
            </label>
            <select
              id="demo-spot"
              value={demoSpot}
              onChange={(e) => setDemoSpot(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
            >
              {DEMO_SPOTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s[lang]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">{t.citizen.demoNote}</p>
          </div>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
          {state?.error === "not_civic" && state.detail ? <span className="block text-xs opacity-80">{state.detail}</span> : null}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 font-semibold text-accent-fg disabled:opacity-70"
      >
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
