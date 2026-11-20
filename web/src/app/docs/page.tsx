import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { Flow } from "@/components/doc-page";
import { PrintButton } from "@/components/print-button";
import { currentDocsAccess, type DocsAccess } from "@/lib/docs-access";
import { envStatus, geminiKeys, groqKeys, modelNames } from "@/lib/env";
import { dateOnly } from "@/lib/format";
import { DUPLICATE_RADIUS_M, MAX_PHOTO_AGE_MINUTES, REPAIR_MAX_DISTANCE_M } from "@/lib/geo";
import { num, type Lang } from "@/lib/i18n";
import { computeKpis, type Kpis } from "@/lib/kpi";
import { KPI_MIN_SAMPLE, sampleStatus } from "@/lib/kpi-math";
import { getSession } from "@/lib/session";
import changelog from "../../../data/docs/changelog.json";

// One page for judges and partners: the pitch, the technical documentation and live system figures.
// Numbers come from the database and the deployment's settings when the page opens; claims that
// need a pilot are labelled as plans. Visibility is set by DOCS_ENABLED / DOCS_FROM / DOCS_UNTIL.

export default function DocsPage() {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <Docs />
    </Suspense>
  );
}

type Tr = (en: string, bn: string) => string;

const SOURCES = {
  population: "https://www.dhakatribune.com/bangladesh/bangladesh-environment/397420/dhaka-emerges-2nd-most-populous-city-in-the-world",
  tib: "https://ti-bangladesh.org/en/articles/press-release/7098",
  cpi: "https://ti-bangladesh.org/en/articles/commentary/7199",
};

async function Docs() {
  await connection();
  const { lang } = await getSession();
  const tr: Tr = (en, bn) => (lang === "en" ? en : bn);
  const access = currentDocsAccess();
  if (!access.open) return <NotAvailable access={access} lang={lang} tr={tr} />;
  const live = await liveSystem();

  const pitch = [
    { id: "problem", title: tr("Problem", "সমস্যা"), body: <Problem tr={tr} /> },
    { id: "solution", title: tr("Solution", "সমাধান"), body: <Solution lang={lang} tr={tr} /> },
    { id: "why-now", title: tr("Why now", "কেন এখন"), body: <WhyNow tr={tr} /> },
    { id: "demo", title: tr("Product demo", "প্রোডাক্ট ডেমো"), body: <Demo tr={tr} /> },
    { id: "advantage", title: tr("What makes it different", "কোথায় আলাদা"), body: <Advantage lang={lang} tr={tr} /> },
    { id: "business", title: tr("Business model and go-to-market (plan)", "ব্যবসায়িক মডেল ও বাজারে যাওয়া (পরিকল্পনা)"), body: <Business tr={tr} /> },
    { id: "traction", title: tr("Traction (live)", "অগ্রগতি (লাইভ)"), body: <Traction live={live} lang={lang} tr={tr} /> },
    { id: "vision", title: tr("Vision", "লক্ষ্য"), body: <Vision tr={tr} /> },
  ];
  const technical = [
    { id: "architecture", title: tr("Architecture and data flow", "আর্কিটেকচার ও ডেটা প্রবাহ"), body: <Architecture tr={tr} /> },
    { id: "stack", title: tr("Technology stack", "প্রযুক্তি"), body: <Stack tr={tr} /> },
    { id: "ai", title: tr("AI layer (live settings)", "এআই স্তর (লাইভ সেটিং)"), body: <AiLayer live={live} lang={lang} tr={tr} /> },
    { id: "data", title: tr("Data layer", "ডেটা স্তর"), body: <DataLayer tr={tr} /> },
    { id: "apis", title: tr("APIs", "API"), body: <Apis tr={tr} /> },
    { id: "security", title: tr("Security and privacy", "নিরাপত্তা ও গোপনীয়তা"), body: <Security tr={tr} /> },
    { id: "analytics", title: tr("Analytics (live KPIs)", "বিশ্লেষণ (লাইভ KPI)"), body: <Analytics live={live} lang={lang} tr={tr} /> },
    { id: "roadmap", title: tr("Roadmap", "পরিকল্পনা"), body: <Roadmap tr={tr} /> },
    { id: "changelog", title: tr("Changelog", "পরিবর্তনের ইতিহাস"), body: <Changelog lang={lang} /> },
  ];

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="hero-banner" style={{ marginTop: 8, marginBottom: 0, padding: "48px 48px", gridTemplateColumns: "1fr" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {tr("Docs · pitch and technical documentation", "ডকস · পিচ ও কারিগরি ডকুমেন্টেশন")}
          </div>
          <h1 className="headline-medium">{tr("CivicTrust: no proof, no payment", "সিভিকট্রাস্ট: প্রমাণ ছাড়া পরিশোধ নয়")}</h1>
          <p className="body-medium" style={{ maxWidth: 760, marginTop: 10, fontSize: "1rem" }}>
            {tr(
              "Citizens photograph broken roads and garbage, AI ranks them, the city assigns the repair, and AI checks the repair photo before the contractor can be paid. Everything on this page is either computed from the live system when it opens or clearly marked as a plan.",
              "নাগরিক ভাঙা রাস্তা আর ময়লার ছবি তোলেন, এআই অগ্রাধিকার ঠিক করে, সিটি মেরামতের দায়িত্ব দেয়, আর ঠিকাদার টাকা পাওয়ার আগে এআই মেরামতের ছবি যাচাই করে। এই পেজের প্রতিটি সংখ্যা খোলার সময় লাইভ সিস্টেম থেকে হিসাব করা, নয়তো পরিকল্পনা হিসেবে স্পষ্ট লেখা।",
            )}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <Link href="/" className="btn btn-filled btn-sm">
              {tr("Open the live demo", "লাইভ ডেমো খুলুন")}
            </Link>
            <PrintButton label={tr("Print or save as PDF", "প্রিন্ট বা PDF হিসেবে রাখুন")} />
          </div>
          {access.until && (
            <p className="label-small" style={{ marginTop: 12 }}>
              {tr(`Available until ${dateOnly(access.until.toISOString(), lang)}.`, `${dateOnly(access.until.toISOString(), lang)} পর্যন্ত দেখা যাবে।`)}
            </p>
          )}
        </div>
      </section>

      <LiveStrip live={live} lang={lang} tr={tr} />

      <nav className="card" aria-label={tr("Sections", "অংশ")}>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
          <SectionLinks heading={tr("Pitch", "পিচ")} items={pitch} />
          <SectionLinks heading={tr("Technical documentation", "কারিগরি ডকুমেন্টেশন")} items={technical} />
        </div>
      </nav>

      <Part heading={tr("Pitch", "পিচ")} items={pitch} />
      <Part heading={tr("Technical documentation", "কারিগরি ডকুমেন্টেশন")} items={technical} />
    </div>
  );
}

type Live = Awaited<ReturnType<typeof liveSystem>>;

/** What the deployment is running right now; never key values, only counts and model names. */
async function liveSystem() {
  const configured = envStatus();
  let kpis: Kpis | null = null;
  if (configured.supabase) {
    try {
      kpis = await computeKpis(null);
    } catch {
      kpis = null;
    }
  }
  return {
    configured,
    kpis,
    models: modelNames(),
    geminiKeys: configured.gemini ? geminiKeys().length : 0,
    groqKeys: configured.groq ? groqKeys().length : 0,
  };
}

function NotAvailable({ access, lang, tr }: { access: Exclude<DocsAccess, { open: true }>; lang: Lang; tr: Tr }) {
  const when = (d: Date) => dateOnly(d.toISOString(), lang);
  const detail =
    access.reason === "not_yet" && access.from
      ? tr(`It opens on ${when(access.from)}.`, `এটি ${when(access.from)} থেকে খুলবে।`)
      : access.reason === "ended" && access.until
        ? tr(`It was available until ${when(access.until)}.`, `এটি ${when(access.until)} পর্যন্ত খোলা ছিল।`)
        : tr("The team has switched it off for now.", "টিম আপাতত এটি বন্ধ রেখেছে।");
  return (
    <section className="card prose-doc" style={{ marginTop: 8 }}>
      <h1 className="headline-small">{tr("Docs are not available right now", "ডকস এখন দেখা যাচ্ছে না")}</h1>
      <p>{detail}</p>
      <p>
        <Link href="/" className="text-link">
          {tr("Go to the live demo", "লাইভ ডেমোতে যান")}
        </Link>
      </p>
    </section>
  );
}

function SectionLinks({ heading, items }: { heading: string; items: { id: string; title: string }[] }) {
  return (
    <div>
      <div className="label-small" style={{ fontWeight: 600, marginBottom: 6 }}>
        {heading}
      </div>
      <ol style={{ paddingLeft: 18, fontSize: "0.85rem", lineHeight: 1.9 }}>
        {items.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="text-link">
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Part({ heading, items }: { heading: string; items: { id: string; title: string; body: ReactNode }[] }) {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <h2 className="headline-small">{heading}</h2>
      <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
        {items.map((s) => (
          <section key={s.id} id={s.id} className="card prose-doc" style={{ scrollMarginTop: 96 }}>
            <h2>{s.title}</h2>
            {s.body}
          </section>
        ))}
      </div>
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="panel">
      <div className="stat-figure">{value}</div>
      <div className="label-small">{label}</div>
    </div>
  );
}

const percent = (v: number | null, lang: Lang) => (v === null ? "—" : `${num(v, lang, 1)}%`);

function statusLabel(n: number, tr: Tr) {
  const s = sampleStatus(n);
  return s === "none" ? tr("no data yet", "এখনো ডেটা নেই") : s === "early" ? tr(`early data, n=${n}`, `প্রাথমিক ডেটা, n=${n}`) : `n=${n}`;
}

function LiveStrip({ live, lang, tr }: { live: Live; lang: Lang; tr: Tr }) {
  const k = live.kpis;
  return (
    <section className="card" aria-label={tr("Live system", "লাইভ সিস্টেম")}>
      <div className="label-small" style={{ fontWeight: 600, marginBottom: 10 }}>
        {tr("Live system, read when this page opened", "লাইভ সিস্টেম, পেজ খোলার সময়ের তথ্য")}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <Figure value={k ? tr("Online", "চালু") : tr("Unavailable", "পাওয়া যাচ্ছে না")} label={tr("Database", "ডেটাবেস")} />
        <Figure value={k ? num(k.counts.issues, lang) : "—"} label={tr("Issues", "সমস্যা")} />
        <Figure value={k ? num(k.counts.reports, lang) : "—"} label={tr("Reports", "রিপোর্ট")} />
        <Figure value={k ? num(k.counts.workOrders, lang) : "—"} label={tr("Work orders", "কাজের আদেশ")} />
        <Figure value={k ? num(k.counts.repairProofs, lang) : "—"} label={tr("Repair photos", "মেরামতের ছবি")} />
        <Figure value={num(live.models.visionChain.length, lang)} label={tr("Vision models (main + backups)", "ভিশন মডেল (মূল + বিকল্প)")} />
      </div>
    </section>
  );
}

function Problem({ tr }: { tr: Tr }) {
  return (
    <>
      <ul>
        <li>
          {tr("Dhaka is the world's second-largest city, with 36.6 million people", "ঢাকা বিশ্বের দ্বিতীয় বৃহত্তম শহর, জনসংখ্যা ৩ কোটি ৬৬ লাখ")} (
          <a href={SOURCES.population} className="text-link" target="_blank" rel="noreferrer">
            {tr("UN World Urbanization Prospects 2025", "জাতিসংঘ, World Urbanization Prospects 2025")}
          </a>
          ).
        </li>
        <li>
          {tr(
            "Transparency International Bangladesh estimates that 23–40% of spending on national road and bridge projects is lost to corruption",
            "টিআইবির হিসাবে জাতীয় সড়ক ও সেতু প্রকল্পের ব্যয়ের ২৩–৪০% দুর্নীতিতে হারিয়ে যায়",
          )}{" "}
          (
          <a href={SOURCES.tib} className="text-link" target="_blank" rel="noreferrer">
            {tr("TIB, October 2024", "টিআইবি, অক্টোবর ২০২৪")}
          </a>
          ).
        </li>
        <li>
          {tr("Bangladesh ranks 151st of 180 countries in the Corruption Perceptions Index 2024 (score 23)", "দুর্নীতির ধারণা সূচক ২০২৪-এ বাংলাদেশ ১৮০ দেশের মধ্যে ১৫১তম (স্কোর ২৩)")} (
          <a href={SOURCES.cpi} className="text-link" target="_blank" rel="noreferrer">
            TIB
          </a>
          ).
        </li>
      </ul>
      <p>
        {tr(
          "A complaint about a pothole or a garbage pile often ends at \"received\". There is no public record of what happens next, and nobody independently checks a repair before the contractor is paid. Officers need a fair, explainable way to decide what to fix first; citizens and the public need proof that money paid for real work.",
          "গর্ত বা ময়লার অভিযোগ প্রায়ই \"গ্রহণ করা হয়েছে\" পর্যন্তই থেমে যায়। এরপর কী হলো তার কোনো প্রকাশ্য রেকর্ড থাকে না, আর ঠিকাদারকে টাকা দেওয়ার আগে কেউ আলাদাভাবে মেরামত যাচাই করে না। কোনটা আগে ঠিক করা দরকার, তা ঠিক করতে কর্মকর্তাদের ন্যায্য ও ব্যাখ্যাযোগ্য উপায় দরকার; নাগরিক আর জনগণের দরকার প্রমাণ যে টাকা আসল কাজের জন্যই দেওয়া হয়েছে।",
        )}
      </p>
    </>
  );
}

function Solution({ lang, tr }: { lang: Lang; tr: Tr }) {
  const m = (n: number) => num(n, lang);
  return (
    <Flow
      steps={[
        { title: tr("Report", "রিপোর্ট"), detail: tr("Citizen photographs the problem, with GPS or a pin on the map.", "নাগরিক সমস্যার ছবি তোলেন, জিপিএস বা ম্যাপে পিন দিয়ে।") },
        { title: tr("Analyse", "বিশ্লেষণ"), detail: tr("Gemini reads the photo: type, severity, hazards. Non-civic photos are rejected.", "জেমিনি ছবি দেখে ধরন, গুরুত্ব ও ঝুঁকি বলে। নাগরিক সমস্যা না হলে বাতিল।") },
        {
          title: tr("Rank", "অগ্রাধিকার"),
          detail: tr(`Transparent 1–10 score; reports within ${m(DUPLICATE_RADIUS_M)} m of the same problem are merged.`, `স্বচ্ছ ১–১০ স্কোর; ${m(DUPLICATE_RADIUS_M)} মিটারের মধ্যে একই সমস্যার রিপোর্ট একসাথে।`),
        },
        { title: tr("Assign", "নিয়োগ"), detail: tr("Officer assigns a contractor or NGO; the deadline follows the pilot service policy.", "কর্মকর্তা ঠিকাদার বা এনজিওকে কাজ দেন; সময়সীমা পাইলট নীতিমালা অনুযায়ী।") },
        {
          title: tr("Verify", "যাচাই"),
          detail: tr(
            `After-photo must be fresh, within ${m(REPAIR_MAX_DISTANCE_M)} m and confirmed by Gemini; unsure cases go to an officer.`,
            `পরের ছবি নতুন হতে হবে, ${m(REPAIR_MAX_DISTANCE_M)} মিটারের মধ্যে, আর জেমিনির নিশ্চিতকরণ লাগবে; অনিশ্চিত হলে কর্মকর্তার কাছে।`,
          ),
        },
        { title: tr("Pay and publish", "পরিশোধ ও প্রকাশ"), detail: tr("Payment only after approval; the citizen confirms or disputes; public scorecards.", "অনুমোদনের পরেই পরিশোধ; নাগরিক নিশ্চিত বা আপত্তি করেন; পাবলিক স্কোরকার্ড।") },
      ]}
    />
  );
}

function WhyNow({ tr }: { tr: Tr }) {
  return (
    <ul>
      <li>
        {tr(
          "Vision-language models can now classify a street photo and compare before and after repair photos without custom training data, so verifying every repair is affordable for a city.",
          "এখনকার ভিশন-ল্যাঙ্গুয়েজ মডেল নিজস্ব প্রশিক্ষণ ডেটা ছাড়াই রাস্তার ছবি চিনতে আর মেরামতের আগে-পরের ছবি তুলনা করতে পারে, তাই প্রতিটি মেরামত যাচাই করা সিটির জন্য সাশ্রয়ী।",
        )}
      </li>
      <li>
        {tr(
          "Bangladesh's Personal Data Protection Ordinance 2025 raises the bar for handling public data. CivicTrust keeps photos private and records every decision in a tamper-evident log.",
          "বাংলাদেশের ব্যক্তিগত তথ্য সুরক্ষা অধ্যাদেশ ২০২৫ জনসাধারণের তথ্য ব্যবস্থাপনার মান বাড়িয়েছে। সিভিকট্রাস্ট ছবি গোপন রাখে আর প্রতিটি সিদ্ধান্ত পরিবর্তন-প্রতিরোধী লগে রাখে।",
        )}
      </li>
    </ul>
  );
}

function Demo({ tr }: { tr: Tr }) {
  return (
    <>
      <p>{tr("The demo has no login: choose a role on the home page and follow one problem from report to verified repair.", "ডেমোতে লগইন নেই: হোম পেজে একটি ভূমিকা বেছে নিন, তারপর একটি সমস্যা রিপোর্ট থেকে যাচাই করা মেরামত পর্যন্ত দেখুন।")}</p>
      <ol>
        <li>{tr("Citizen: report a photo and see the live AI assessment.", "নাগরিক: ছবি দিয়ে রিপোর্ট করুন, সঙ্গে সঙ্গে এআই মূল্যায়ন দেখুন।")}</li>
        <li>{tr("Ward officer: work the ranked queue, correct the AI if needed, assign the job.", "ওয়ার্ড কর্মকর্তা: অগ্রাধিকার তালিকা দেখুন, দরকার হলে এআই সংশোধন করুন, কাজ দিন।")}</li>
        <li>{tr("Contractor: upload the after-photo; the AI and the rules decide.", "ঠিকাদার: পরের ছবি দিন; এআই আর নিয়ম মিলে সিদ্ধান্ত নেয়।")}</li>
        <li>{tr("Public: see progress, the update log and contractor scorecards.", "জনসাধারণ: অগ্রগতি, আপডেট লগ আর ঠিকাদার স্কোরকার্ড দেখুন।")}</li>
      </ol>
      <p>
        <Link href="/" className="text-link">
          {tr("Choose a role", "ভূমিকা বেছে নিন")}
        </Link>{" "}
        ·{" "}
        <Link href="/public" className="text-link">
          {tr("Public portal", "পাবলিক পোর্টাল")}
        </Link>
      </p>
    </>
  );
}

function Advantage({ lang, tr }: { lang: Lang; tr: Tr }) {
  return (
    <ul>
      <li>
        <strong>{tr("It verifies the outcome, not just the complaint.", "শুধু অভিযোগ নয়, ফল যাচাই করে।")}</strong>{" "}
        {tr(
          `A repair is approved automatically only with an after-photo captured in the app at most ${num(MAX_PHOTO_AGE_MINUTES, lang)} minutes before upload, measured GPS within ${num(REPAIR_MAX_DISTANCE_M, lang)} m and a confident AI comparison.`,
          `মেরামত নিজে থেকে অনুমোদন পায় শুধু তখনই, যখন পরের ছবি আপলোডের সর্বোচ্চ ${num(MAX_PHOTO_AGE_MINUTES, lang)} মিনিট আগে অ্যাপেই তোলা, জিপিএস ${num(REPAIR_MAX_DISTANCE_M, lang)} মিটারের মধ্যে, আর এআই নিশ্চিতভাবে মিলিয়েছে।`,
        )}
      </li>
      <li>
        <strong>{tr("Payment is gated.", "পরিশোধে শর্ত আছে।")}</strong>{" "}
        {tr("Payment stays withheld until the repair is approved, and a citizen dispute reopens review.", "মেরামত অনুমোদন না হওয়া পর্যন্ত পরিশোধ আটকে থাকে, আর নাগরিকের আপত্তিতে আবার পর্যালোচনা হয়।")}
      </li>
      <li>
        <strong>{tr("Explainable ranking.", "ব্যাখ্যাযোগ্য অগ্রাধিকার।")}</strong>{" "}
        {tr("The urgency score is a formula with every factor shown; AI only describes the photo and explains the result.", "জরুরিতার স্কোর একটি সূত্র, প্রতিটি উপাদান দেখানো হয়; এআই শুধু ছবির বর্ণনা দেয় আর ফল ব্যাখ্যা করে।")}
      </li>
      <li>
        <strong>{tr("Tamper-evident record.", "পরিবর্তন-প্রতিরোধী রেকর্ড।")}</strong>{" "}
        {tr("Every state change and AI override goes into a hash-chained audit log.", "প্রতিটি অবস্থা পরিবর্তন আর এআই সংশোধন হ্যাশ-শৃঙ্খলিত অডিট লগে যায়।")}
      </li>
    </ul>
  );
}

function Business({ tr }: { tr: Tr }) {
  return (
    <>
      <ul>
        <li>{tr("Customers: city corporations and municipalities, as a subscription priced per ward.", "গ্রাহক: সিটি কর্পোরেশন ও পৌরসভা, ওয়ার্ডপ্রতি সাবস্ক্রিপশন।")}</li>
        <li>{tr("Also: donor and development-bank urban programmes that need verified-outcome reporting.", "আরও: দাতা সংস্থা ও উন্নয়ন ব্যাংকের নগর কর্মসূচি, যাদের যাচাই করা ফলাফলের রিপোর্ট দরকার।")}</li>
        <li>{tr("Path: free pilot in 2–4 wards → paid city contract → national roll-out → other countries.", "পথ: ২–৪টি ওয়ার্ডে বিনামূল্যে পাইলট → সিটির সঙ্গে চুক্তি → সারা দেশে → অন্য দেশে।")}</li>
      </ul>
      <p className="label-small">
        {tr(
          "This is a plan and has not been validated with a customer. Prices and market sizes will be stated only with cited sources.",
          "এটি পরিকল্পনা, কোনো গ্রাহকের সঙ্গে যাচাই হয়নি। দাম আর বাজারের আকার শুধু উৎসসহ বলা হবে।",
        )}
      </p>
    </>
  );
}

function Traction({ live, lang, tr }: { live: Live; lang: Lang; tr: Tr }) {
  const k = live.kpis;
  return (
    <>
      {k ? (
        <ul>
          <li>{tr(`${num(k.counts.reports, lang)} reports and ${num(k.counts.issues, lang)} issues in the live database.`, `লাইভ ডেটাবেসে ${num(k.counts.reports, lang)}টি রিপোর্ট আর ${num(k.counts.issues, lang)}টি সমস্যা।`)}</li>
          <li>{tr(`${num(k.counts.workOrders, lang)} work orders and ${num(k.counts.repairProofs, lang)} repair photos checked.`, `${num(k.counts.workOrders, lang)}টি কাজের আদেশ আর ${num(k.counts.repairProofs, lang)}টি মেরামতের ছবি যাচাই।`)}</li>
        </ul>
      ) : (
        <p>{tr("Live figures are unavailable right now.", "লাইভ তথ্য এখন পাওয়া যাচ্ছে না।")}</p>
      )}
      <p className="label-small">
        {tr(
          "These records come from the team's own testing in the Dhanmondi pilot area. No city pilot has started yet.",
          "এই রেকর্ডগুলো ধানমন্ডি পাইলট এলাকায় টিমের নিজের পরীক্ষা থেকে। সিটির সঙ্গে পাইলট এখনো শুরু হয়নি।",
        )}
      </p>
    </>
  );
}

function Vision({ tr }: { tr: Tr }) {
  return (
    <ul>
      <li>{tr("The same problem exists in fast-growing cities across South Asia, Africa and Southeast Asia.", "দক্ষিণ এশিয়া, আফ্রিকা আর দক্ষিণ-পূর্ব এশিয়ার দ্রুত বাড়তে থাকা শহরগুলোতেও একই সমস্যা।")}</li>
      <li>{tr("Explanations can be generated in any language, and an Open311-compatible API will let cities plug it into their systems.", "যেকোনো ভাষায় ব্যাখ্যা তৈরি করা যায়, আর Open311-সামঞ্জস্যপূর্ণ API দিয়ে সিটি নিজের সিস্টেমে যুক্ত করতে পারবে।")}</li>
      <li>{tr("Goal: public money is paid only for repairs that really happened, and every citizen can see it.", "লক্ষ্য: জনগণের টাকা শুধু সত্যিকারের মেরামতেই খরচ হবে, আর প্রত্যেক নাগরিক তা দেখতে পাবেন।")}</li>
    </ul>
  );
}

function Architecture({ tr }: { tr: Tr }) {
  return (
    <>
      <Flow
        steps={[
          { title: tr("Browser", "ব্রাউজার"), detail: tr("Five role views, Bangla and English, camera, GPS, Leaflet map.", "পাঁচটি ভূমিকার ভিউ, বাংলা ও ইংরেজি, ক্যামেরা, জিপিএস, Leaflet ম্যাপ।") },
          { title: tr("Server", "সার্ভার"), detail: tr("Next.js server actions: validation, score, payment gate.", "Next.js সার্ভার অ্যাকশন: যাচাই, স্কোর, পরিশোধের শর্ত।") },
          { title: "AI", detail: tr("Gemini vision and embeddings; Groq, then GLM, for explanations.", "জেমিনি ভিশন ও এমবেডিং; ব্যাখ্যার জন্য Groq, তারপর GLM।") },
          { title: tr("Data", "ডেটা"), detail: tr("Postgres + PostGIS + pgvector, private photos, audit log.", "Postgres + PostGIS + pgvector, গোপন ছবি, অডিট লগ।") },
        ]}
      />
      <p>
        {tr("The browser never talks to the database: all access goes through the server with a secret key.", "ব্রাউজার কখনো সরাসরি ডেটাবেসে যায় না: সব অ্যাক্সেস সার্ভারের গোপন কী দিয়ে।")}{" "}
        <Link href="/architecture" className="text-link">
          {tr("Full architecture", "পুরো আর্কিটেকচার")}
        </Link>
      </p>
    </>
  );
}

function Stack({ tr }: { tr: Tr }) {
  return (
    <ul>
      <li>
        <strong>{tr("Frontend", "ফ্রন্টএন্ড")}</strong> — Next.js 16, React 19, Tailwind CSS, Leaflet, Recharts
      </li>
      <li>
        <strong>{tr("Backend", "ব্যাকএন্ড")}</strong> — {tr("Next.js server actions, Zod validation, TypeScript", "Next.js সার্ভার অ্যাকশন, Zod যাচাই, TypeScript")}
      </li>
      <li>
        <strong>{tr("Database", "ডেটাবেস")}</strong> — {tr("Supabase Postgres with PostGIS and pgvector, private storage", "Supabase Postgres, PostGIS ও pgvector সহ, গোপন স্টোরেজ")}
      </li>
      <li>
        <strong>AI</strong> — Google Gemini, Groq, Zhipu GLM
      </li>
      <li>
        <strong>{tr("Infrastructure", "অবকাঠামো")}</strong> — {tr("Vercel and Supabase in Singapore; GitHub Actions CI", "সিঙ্গাপুরে Vercel ও Supabase; GitHub Actions CI")}
      </li>
    </ul>
  );
}

function AiLayer({ live, lang, tr }: { live: Live; lang: Lang; tr: Tr }) {
  const [main, ...backups] = live.models.visionChain;
  return (
    <>
      <div className="table-wrap">
        <table className="md-table">
          <thead>
            <tr>
              <th>{tr("Step", "ধাপ")}</th>
              <th>{tr("Model", "মডেল")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{tr("Photo, duplicate and repair checks", "ছবি, ডুপ্লিকেট ও মেরামত যাচাই")}</td>
              <td className="mono">
                {main}
                {backups.length > 0 && (
                  <span className="label-small" style={{ display: "block" }}>
                    {tr("backups", "বিকল্প")}: {backups.join(", ")}
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td>{tr("Policy search (RAG)", "নীতিমালা খোঁজা (RAG)")}</td>
              <td className="mono">{live.models.embedding}</td>
            </tr>
            <tr>
              <td>{tr("Explanation (main)", "ব্যাখ্যা (মূল)")}</td>
              <td className="mono">{live.models.text}</td>
            </tr>
            <tr>
              <td>{tr("Explanation (backup)", "ব্যাখ্যা (বিকল্প)")}</td>
              <td className="mono">{live.models.textFallback}</td>
            </tr>
            <tr>
              <td>{tr("Explanation (local backup, Ollama)", "ব্যাখ্যা (লোকাল বিকল্প, Ollama)")}</td>
              <td className="mono">{live.models.textLocal ?? tr("not configured on this server", "এই সার্ভারে চালু নেই")}</td>
            </tr>
            <tr>
              <td>{tr("Officer assistant (Mastra agent, 7 read-only tools)", "কর্মকর্তার সহকারী (Mastra এজেন্ট, ৭টি শুধু-পড়ার টুল)")}</td>
              <td className="mono">{live.models.text}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        {tr(
          `Requests are spread across ${num(live.geminiKeys, lang)} Gemini and ${num(live.groqKeys, lang)} Groq API keys. The score is computed in code; text models may only use the computed facts. Uncertain results go to a person.`,
          `অনুরোধগুলো ${num(live.geminiKeys, lang)}টি জেমিনি আর ${num(live.groqKeys, lang)}টি Groq API কী-তে ভাগ করা হয়। স্কোর কোডে হিসাব হয়; টেক্সট মডেল শুধু হিসাব করা তথ্যই ব্যবহার করতে পারে। অনিশ্চিত ফল মানুষের কাছে যায়।`,
        )}{" "}
        <Link href="/model-card" className="text-link">
          {tr("Model card", "মডেল কার্ড")}
        </Link>
      </p>
    </>
  );
}

function DataLayer({ tr }: { tr: Tr }) {
  return (
    <>
      <ul>
        <li>{tr("Citizen and contractor photos with GPS; officer and citizen actions.", "জিপিএসসহ নাগরিক ও ঠিকাদারের ছবি; কর্মকর্তা ও নাগরিকের কাজ।")}</li>
        <li>{tr("OpenStreetMap roads, schools and hospitals for the pilot area (ODbL), and OSM place names.", "পাইলট এলাকার OpenStreetMap রাস্তা, স্কুল ও হাসপাতাল (ODbL), আর OSM-এর জায়গার নাম।")}</li>
        <li>{tr("The team's pilot service policy, embedded for retrieval.", "টিমের পাইলট সেবা নীতিমালা, খোঁজার জন্য এমবেড করা।")}</li>
        <li>{tr("Photos are stored privately; photos that are not civic problems are never stored.", "ছবি গোপনে রাখা হয়; নাগরিক সমস্যা নয় এমন ছবি কখনো রাখা হয় না।")}</li>
      </ul>
      <p>
        <Link href="/data" className="text-link">
          {tr("Sources, licences and schema", "উৎস, লাইসেন্স ও স্কিমা")}
        </Link>
      </p>
    </>
  );
}

function Apis({ tr }: { tr: Tr }) {
  return (
    <>
      <p>
        <strong>{tr("Used", "ব্যবহৃত")}</strong>: Google Gemini, Groq, Zhipu GLM, OpenStreetMap Overpass, OpenStreetMap Nominatim, Supabase,{" "}
        {tr("and optionally a local Ollama model.", "আর ঐচ্ছিকভাবে একটি লোকাল Ollama মডেল।")}
      </p>
      <p>
        <strong>{tr("Exposed", "প্রকাশিত")}</strong>:{" "}
        <a href="/api/health" className="text-link mono">
          GET /api/health
        </a>{" "}
        —{" "}
        {tr(
          "database status and AI configuration (counts and model names, never keys), for uptime checks. No sign-in is needed. There is no public write API: changes happen only through the app's server actions.",
          "ডেটাবেসের অবস্থা আর এআই কনফিগারেশন (সংখ্যা ও মডেলের নাম, কী কখনো নয়), আপটাইম যাচাইয়ের জন্য। সাইন-ইন লাগে না। লেখার জন্য কোনো পাবলিক API নেই: পরিবর্তন হয় শুধু অ্যাপের সার্ভার অ্যাকশন দিয়ে।",
        )}
      </p>
      <p>
        <span className="mono">POST /api/mcp</span> —{" "}
        {tr(
          "read-only MCP server (Streamable HTTP) for AI assistants, with six tools: list issues, issue timeline, repair-policy search, contractor scorecards, impact summary and audit-chain check. Needs a bearer token set by the operator; returns no coordinates, photos, names or comments, and cannot change data.",
          "এআই সহকারীর জন্য শুধু-পড়ার MCP সার্ভার (Streamable HTTP), ছয়টি টুলসহ: সমস্যার তালিকা, সমস্যার টাইমলাইন, মেরামত-নীতি খোঁজা, ঠিকাদারের স্কোরকার্ড, প্রভাবের সারাংশ আর অডিট-চেইন যাচাই। অপারেটরের দেওয়া বেয়ারার টোকেন লাগে; অবস্থান, ছবি, নাম বা মন্তব্য দেয় না, আর কোনো ডেটা বদলাতে পারে না।",
        )}
      </p>
      <p>
        <span className="mono">GET /api/automation/overdue</span> —{" "}
        {tr(
          "the daily overdue-repair check, called by Vercel Cron or an n8n workflow with a secret. It records each work order that missed its deadline once, for officers and the public update log.",
          "দৈনিক সময়সীমা যাচাই, Vercel Cron বা n8n ওয়ার্কফ্লো গোপন চাবি দিয়ে ডাকে। সময়সীমা পেরোনো প্রতিটি কাজের আদেশ একবার লেখা হয়, কর্মকর্তা আর পাবলিক আপডেট লগের জন্য।",
        )}
      </p>
      <p className="label-small">{tr("Planned: an Open311 (GeoReport v2) compatible API.", "পরিকল্পনা: Open311 (GeoReport v2) সামঞ্জস্যপূর্ণ API।")}</p>
    </>
  );
}

function Security({ tr }: { tr: Tr }) {
  return (
    <>
      <ul>
        <li>{tr("No login in the prototype; roles come from a demo switcher and are checked on the server.", "প্রোটোটাইপে লগইন নেই; ভূমিকা আসে ডেমো সুইচার থেকে, আর সার্ভারে যাচাই হয়।")}</li>
        <li>{tr("Secret keys stay on the server; photos are shown only through short-lived signed links.", "গোপন কী সার্ভারেই থাকে; ছবি দেখানো হয় শুধু অল্প সময়ের সাইন করা লিংকে।")}</li>
        <li>{tr("Public pages show no reporter names or exact locations; AI flags readable faces and number plates.", "পাবলিক পেজে রিপোর্টকারীর নাম বা সঠিক অবস্থান থাকে না; এআই পড়া যায় এমন মুখ ও নম্বর প্লেট চিহ্নিত করে।")}</li>
        <li>{tr("Every state change and AI override is written to an append-only, hash-chained audit log.", "প্রতিটি অবস্থা পরিবর্তন আর এআই সংশোধন শুধু-যোগযোগ্য, হ্যাশ-শৃঙ্খলিত অডিট লগে লেখা হয়।")}</li>
        <li>{tr("Data is hosted in Singapore; a Bangladesh-hosted database is planned for the data protection ordinance.", "ডেটা সিঙ্গাপুরে রাখা; তথ্য সুরক্ষা অধ্যাদেশের জন্য বাংলাদেশে ডেটাবেস রাখার পরিকল্পনা আছে।")}</li>
      </ul>
      <p>
        <Link href="/security" className="text-link">
          {tr("Security details", "নিরাপত্তার বিস্তারিত")}
        </Link>{" "}
        ·{" "}
        <Link href="/audit" className="text-link">
          {tr("Audit log", "অডিট লগ")}
        </Link>
      </p>
    </>
  );
}

function Analytics({ live, lang, tr }: { live: Live; lang: Lang; tr: Tr }) {
  const k = live.kpis;
  if (!k) return <p>{tr("Live figures are unavailable right now.", "লাইভ তথ্য এখন পাওয়া যাচ্ছে না।")}</p>;
  const rows = [
    { what: tr("Photo analysis answered", "ছবি বিশ্লেষণে উত্তর এসেছে"), value: percent(k.photoAnalysis.pct, lang), n: k.photoAnalysis.of },
    { what: tr("Reports merged as duplicates", "ডুপ্লিকেট হিসেবে একসাথে করা রিপোর্ট"), value: percent(k.duplicateMerge.pct, lang), n: k.duplicateMerge.of },
    {
      what: tr("Photo to ranked issue (median)", "ছবি থেকে অগ্রাধিকার পর্যন্ত (মধ্যমা)"),
      value: k.triageMs.median === null ? "—" : `${num(k.triageMs.median / 1000, lang, 1)} ${tr("s", "সেকেন্ড")}`,
      n: k.triageMs.n,
    },
    { what: tr("Issues where an officer corrected the AI", "যেসব সমস্যায় কর্মকর্তা এআই সংশোধন করেছেন"), value: percent(k.officerCorrections.pct, lang), n: k.officerCorrections.of },
    { what: tr("Records with their audit entry", "অডিট এন্ট্রিসহ রেকর্ড"), value: percent(k.auditCompletion.pct, lang), n: k.auditCompletion.of },
  ];
  return (
    <>
      <div className="table-wrap">
        <table className="md-table">
          <thead>
            <tr>
              <th>{tr("Measure", "মাপকাঠি")}</th>
              <th>{tr("Live", "লাইভ")}</th>
              <th>{tr("Sample", "নমুনা")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.what}>
                <td>{r.what}</td>
                <td>{r.value}</td>
                <td className="label-small">{statusLabel(r.n, tr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        {tr(
          `All records so far. Under ${num(KPI_MIN_SAMPLE, lang)} records a figure is early data, not a result.`,
          `এ পর্যন্ত সব রেকর্ড। ${num(KPI_MIN_SAMPLE, lang)}টির কম রেকর্ড থাকলে সংখ্যাটি প্রাথমিক ডেটা, ফল নয়।`,
        )}{" "}
        <Link href="/impact" className="text-link">
          {tr("All KPIs and charts", "সব KPI ও চার্ট")}
        </Link>
      </p>
    </>
  );
}

function Roadmap({ tr }: { tr: Tr }) {
  return (
    <>
      <p>
        <strong>{tr("Finals (Nov–Dec 2026)", "ফাইনাল (নভেম্বর–ডিসেম্বর ২০২৬)")}</strong>
      </p>
      <ul>
        <li>{tr("A field pilot with real reports and measured KPIs.", "আসল রিপোর্ট আর মাপা KPI নিয়ে মাঠ পর্যায়ের পাইলট।")}</li>
        <li>{tr("Self-hosted vision models so photos stay on city infrastructure.", "নিজস্ব সার্ভারে ভিশন মডেল, যাতে ছবি সিটির অবকাঠামোতেই থাকে।")}</li>
        <li>{tr("Extend the \"Ask CivicTrust\" officer assistant: follow-up questions and a weekly area summary.", "\"Ask CivicTrust\" সহকারী আরও বাড়ানো: পরের প্রশ্ন মনে রাখা আর সাপ্তাহিক এলাকাভিত্তিক সারাংশ।")}</li>
        <li>{tr("Accountability view linking issue, area, road, contractor and payment, with repeat-failure flags.", "সমস্যা, এলাকা, রাস্তা, ঠিকাদার আর পরিশোধ একসাথে দেখার জবাবদিহি ভিউ, বারবার ব্যর্থতার চিহ্নসহ।")}</li>
        <li>{tr("Open311-compatible API for city systems.", "সিটির সিস্টেমের জন্য Open311-সামঞ্জস্যপূর্ণ API।")}</li>
      </ul>
      <p>
        <strong>{tr("Later", "পরে")}</strong>
      </p>
      <ul>
        <li>{tr("Phone sign-in and per-user permissions, SMS and push updates, offline reporting.", "ফোন দিয়ে সাইন-ইন ও প্রত্যেকের আলাদা অনুমতি, SMS ও পুশ আপডেট, অফলাইনে রিপোর্ট।")}</li>
        <li>{tr("Bangladesh-hosted database and support for more cities.", "বাংলাদেশে ডেটাবেস আর আরও শহরের জন্য ব্যবস্থা।")}</li>
      </ul>
    </>
  );
}

function Changelog({ lang }: { lang: Lang }) {
  return (
    <ul style={{ listStyle: "none", paddingLeft: 0 }}>
      {changelog.map((c) => (
        <li key={`${c.date} ${c.en}`} style={{ marginBottom: 8 }}>
          <span className="label-small" style={{ display: "block", fontWeight: 600 }}>
            {dateOnly(`${c.date}T12:00:00+06:00`, lang)}
          </span>
          {lang === "en" ? c.en : c.bn}
        </li>
      ))}
    </ul>
  );
}
