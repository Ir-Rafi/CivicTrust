import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { ImpactCharts, type ImpactChartsProps } from "@/components/impact/impact-charts";
import { computeKpis, type Kpis } from "@/lib/kpi";
import { KPI_MIN_SAMPLE, parseSince, sampleStatus } from "@/lib/kpi-math";
import { dateOnly } from "@/lib/format";
import { DUPLICATE_RADIUS_M } from "@/lib/geo";
import { num, type Lang } from "@/lib/i18n";
import { getSession } from "@/lib/session";

// Expected outcomes next to what the live system has actually measured. Every figure is computed
// from the database when the page opens (same code as `pnpm kpi`); nothing here is typed in.
// Window: ?since=YYYY-MM-DD, else KPI_SINCE from the environment, else all records.

export default function ImpactPage({ searchParams }: PageProps<"/impact">) {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <Impact searchParams={searchParams} />
    </Suspense>
  );
}

type Tr = (en: string, bn: string) => string;

async function Impact({ searchParams }: Pick<PageProps<"/impact">, "searchParams">) {
  await connection();
  const [{ lang }, query] = await Promise.all([getSession(), searchParams]);
  const tr: Tr = (en, bn) => (lang === "en" ? en : bn);
  const sinceParam = typeof query.since === "string" ? query.since : undefined;
  const since = parseSince(sinceParam) ?? parseSince(process.env.KPI_SINCE);
  const k = await computeKpis(since);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <section className="hero-banner" style={{ marginTop: 8, marginBottom: 0, padding: "48px 48px", gridTemplateColumns: "1fr" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {tr("Impact", "প্রভাব")}
          </div>
          <h1 className="headline-medium">{tr("Expected outcomes, and what we have measured so far", "প্রত্যাশিত ফল, আর এ পর্যন্ত যা মাপা হয়েছে")}</h1>
          <p className="body-medium" style={{ maxWidth: 760, marginTop: 10, fontSize: "1rem" }}>
            {tr(
              `Each number below is calculated from the live database when this page opens: nothing is typed in by hand. With fewer than ${KPI_MIN_SAMPLE} records a figure is marked as early data, not a result. Outcomes that need a real pilot are marked as not measured.`,
              `নিচের প্রতিটি সংখ্যা পেজটি খোলার সময় সরাসরি ডেটাবেস থেকে হিসাব করা হয়: হাতে কিছু বসানো নেই। ${num(KPI_MIN_SAMPLE, lang)}টির কম রেকর্ড থাকলে সংখ্যাটিকে প্রাথমিক ডেটা বলা হয়, ফল নয়। যেগুলো মাপতে আসল পাইলট লাগবে, সেগুলো "মাপা হয়নি" লেখা।`,
            )}
          </p>
          <p className="label-small" style={{ marginTop: 12 }}>
            {since
              ? tr(`Records from ${dateOnly(`${since}T00:00:00+06:00`, lang)} onwards.`, `${dateOnly(`${since}T00:00:00+06:00`, lang)} থেকে পরের রেকর্ড।`)
              : tr("All records so far.", "এ পর্যন্ত সব রেকর্ড।")}{" "}
            {tr(
              `Issues: ${num(k.counts.issues, lang)} · reports: ${num(k.counts.reports, lang)} · work orders: ${num(k.counts.workOrders, lang)} · repair photos: ${num(k.counts.repairProofs, lang)}`,
              `${num(k.counts.issues, lang)}টি সমস্যা, ${num(k.counts.reports, lang)}টি রিপোর্ট, ${num(k.counts.workOrders, lang)}টি কাজের আদেশ, ${num(k.counts.repairProofs, lang)}টি মেরামতের ছবি।`,
            )}
          </p>
        </div>
      </section>

      <ImpactCharts {...chartProps(k, lang, tr)} />

      <Outcomes k={k} lang={lang} tr={tr} />
      <Reliability k={k} lang={lang} tr={tr} />
      <AuditDetail k={k} lang={lang} tr={tr} />

      <section className="card prose-doc">
        <h2>{tr("Not measured on this page", "এই পেজে যা মাপা হয় না")}</h2>
        <ul>
          <li>
            {tr(
              "Photo-classification and repair-check accuracy: these need photos labelled by people, scored with the evaluation script (pnpm eval:photos).",
              "ছবি শনাক্তকরণ আর মেরামত যাচাইয়ের নির্ভুলতা: এর জন্য মানুষের লেবেল দেওয়া ছবি লাগে, যা মূল্যায়ন স্ক্রিপ্ট দিয়ে মাপা হয় (pnpm eval:photos)।",
            )}
          </li>
          <li>
            {tr(
              "Real fix times, citizen confirmation rates and how well people understand the public tracker: these need a pilot with the city.",
              "আসল মেরামতের সময়, নাগরিকদের নিশ্চিত করার হার, আর পাবলিক ট্র্যাকার মানুষ কতটা বোঝে: এর জন্য সিটি কর্পোরেশনের সঙ্গে পাইলট লাগবে।",
            )}
          </li>
        </ul>
      </section>
    </div>
  );
}

/** The same figures as the tables below, shaped for the interactive charts. */
function chartProps(k: Kpis, lang: Lang, tr: Tr): ImpactChartsProps {
  const rate = (key: string, label: string, part: number, whole: number, pctValue: number | null, hint?: string) => ({
    key,
    label,
    hint,
    part,
    whole,
    pct: pctValue,
    status: sampleStatus(whole),
  });
  const e = k.explanations;
  const failedLabel = tr("Failed", "ব্যর্থ");
  return {
    lang,
    copy: {
      outcomesTitle: tr("Outcome KPIs", "ফলের মাপকাঠি"),
      outcomesNote: tr("Live rate for each expected outcome. Hover a bar for counts and sample size.", "প্রতিটি প্রত্যাশিত ফলের সরাসরি হার। সংখ্যা আর নমুনার আকার দেখতে বারের ওপর রাখুন।"),
      reliabilityTitle: tr("AI reliability by step", "ধাপ অনুযায়ী এআই-এর নির্ভরযোগ্যতা"),
      reliabilityNote: tr("Share of runs handled by the main AI, by a backup or a person, or that failed.", "কত ভাগ কাজ মূল এআই করেছে, কত ভাগে বিকল্প বা মানুষ লেগেছে, আর কত ভাগ ব্যর্থ।"),
      triageTitle: tr("Photo to ranked issue", "ছবি থেকে ক্রম পাওয়া সমস্যা"),
      triageNote: tr("How long each report took from upload to a scored, ranked issue.", "আপলোড থেকে স্কোরসহ ক্রমে ওঠা পর্যন্ত প্রতিটি রিপোর্টে কত সময় লেগেছে।"),
      auditTitle: tr("Audit coverage", "অডিট কভারেজ"),
      auditNote: tr("Stored records with their entry in the tamper-evident log, by type.", "ধরন অনুযায়ী, যেসব রেকর্ডের এন্ট্রি পরিবর্তন-ধরা-পড়া লগে আছে।"),
      legendPrimary: tr("Main AI", "মূল এআই"),
      legendBackup: tr("Backup or person", "বিকল্প বা মানুষ"),
      legendFailed: failedLabel,
      legendLogged: tr("Logged", "লগ হয়েছে"),
      legendMissing: tr("Missing", "নেই"),
      noData: tr("No data yet", "এখনো ডেটা নেই"),
      early: tr("Early data", "প্রাথমিক ডেটা"),
      measured: tr("Measured", "মাপা হয়েছে"),
      reports: tr("Reports", "রিপোর্ট"),
      seconds: tr("s", "সে."),
      median: tr("Median", "মধ্যমা"),
      p90: "p90",
      ofTotal: tr("of", "/"),
      notYetRecorded: tr("Nothing recorded yet", "এখনো কিছু রেকর্ড হয়নি"),
      tableHint: tr("The same figures are listed in the tables below.", "একই সংখ্যাগুলো নিচের টেবিলেও দেওয়া আছে।"),
    },
    rates: [
      rate("merge", tr("Reports merged", "যুক্ত হওয়া রিপোর্ট"), k.duplicateMerge.merged, k.duplicateMerge.of, k.duplicateMerge.pct),
      rate("closure", tr("False repair closures", "ভুল মেরামত বন্ধ"), k.falseClosure.overturned, k.falseClosure.of, k.falseClosure.pct, tr("lower is better", "যত কম তত ভালো")),
      rate("payments", tr("Payments with approved repair", "অনুমোদিত মেরামতসহ টাকা ছাড়"), k.paymentsBacked.backed, k.paymentsBacked.of, k.paymentsBacked.pct),
      rate("audit", tr("Records with audit entry", "অডিট এন্ট্রিসহ রেকর্ড"), k.auditCompletion.recorded, k.auditCompletion.of, k.auditCompletion.pct),
      rate("corrections", tr("Issues corrected by officer", "কর্মকর্তার সংশোধিত সমস্যা"), k.officerCorrections.corrected, k.officerCorrections.of, k.officerCorrections.pct),
    ],
    reliability: [
      {
        key: "photo",
        label: tr("Photo analysis", "ছবি বিশ্লেষণ"),
        primary: k.photoAnalysis.ok,
        backup: 0,
        failed: k.photoAnalysis.failed,
        names: { primary: tr("Answered by Gemini", "Gemini উত্তর দিয়েছে"), backup: null, failed: failedLabel },
        status: sampleStatus(k.photoAnalysis.of),
      },
      {
        key: "explain",
        label: tr("Bangla/English reason", "বাংলা/ইংরেজি কারণ"),
        primary: e.groq,
        backup: e.glm + e.ollama,
        failed: e.none,
        names: { primary: "Groq", backup: tr("GLM or local model (backup)", "GLM বা লোকাল মডেল (বিকল্প)"), failed: tr("None answered", "কেউ উত্তর দেয়নি") },
        status: sampleStatus(e.of),
      },
      {
        key: "duplicate",
        label: tr("Duplicate comparison", "ডুপ্লিকেট তুলনা"),
        primary: k.duplicateCompare.of - k.duplicateCompare.failures,
        backup: 0,
        failed: k.duplicateCompare.failures,
        names: { primary: tr("Compared", "তুলনা হয়েছে"), backup: null, failed: failedLabel },
        status: sampleStatus(k.duplicateCompare.of),
      },
      {
        key: "repair",
        label: tr("Repair check", "মেরামত যাচাই"),
        primary: k.repairAi.of - k.repairAi.failed,
        backup: 0,
        failed: k.repairAi.failed,
        names: { primary: tr("Checked by Gemini", "Gemini যাচাই করেছে"), backup: null, failed: tr("Failed, sent to an officer", "ব্যর্থ, কর্মকর্তার কাছে") },
        status: sampleStatus(k.repairAi.of),
      },
      {
        key: "override",
        label: tr("AI result kept", "এআই-এর ফল বহাল"),
        primary: k.officerCorrections.of - k.officerCorrections.corrected,
        backup: k.officerCorrections.corrected,
        failed: 0,
        names: { primary: tr("Kept as the AI judged", "এআই যেমন বলেছে"), backup: tr("Corrected by an officer", "কর্মকর্তা সংশোধন করেছেন"), failed: failedLabel },
        status: sampleStatus(k.officerCorrections.of),
      },
    ],
    triage: { samplesMs: k.triageMs.samples, medianMs: k.triageMs.median, p90Ms: k.triageMs.p90 },
    audit: k.auditCompletion.detail.map((d) => {
      const label = AUDIT_LABELS[d.record];
      return { label: label ? tr(label[0], label[1]) : d.record, recorded: d.recorded, expected: d.expected };
    }),
  };
}

function Status({ n, lang, tr }: { n: number; lang: Lang; tr: Tr }) {
  const s = sampleStatus(n);
  if (s === "none") return <span className="tag">{tr("No data yet", "এখনো ডেটা নেই")}</span>;
  if (s === "early") return <span className="tag warning">{tr(`Early data (n=${n})`, `প্রাথমিক ডেটা (n=${num(n, lang)})`)}</span>;
  return <span className="tag verified">{tr(`Measured (n=${n})`, `মাপা হয়েছে (n=${num(n, lang)})`)}</span>;
}

const percent = (v: number | null, lang: Lang) => (v === null ? "—" : `${num(v, lang, 1)}%`);
const seconds = (ms: number | null, lang: Lang) => (ms === null ? "—" : `${num(ms / 1000, lang, 1)} s`);

function Card({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="headline-small">{title}</h2>
          <p className="label-small">{note}</p>
        </div>
      </div>
      <div className="table-wrap">{children}</div>
    </section>
  );
}

function Outcomes({ k, lang, tr }: { k: Kpis; lang: Lang; tr: Tr }) {
  const rows: { outcome: string; how: string; kpi: string; result: string; n: number | null }[] = [
    {
      outcome: tr("Faster triage", "দ্রুত অগ্রাধিকার ঠিক করা"),
      how: tr("AI reads the photo; a fixed formula ranks it", "এআই ছবি পড়ে; নির্দিষ্ট সূত্রে ক্রম ঠিক হয়"),
      kpi: tr("Photo to ranked issue (median, p90)", "ছবি থেকে ক্রম পাওয়া সমস্যা (মধ্যমা, p90)"),
      result: k.triageMs.n ? `${seconds(k.triageMs.median, lang)} · p90 ${seconds(k.triageMs.p90, lang)}` : "—",
      n: k.triageMs.n,
    },
    {
      outcome: tr("Less duplicate work", "একই কাজ বারবার কম"),
      how: tr(`Reports within ${DUPLICATE_RADIUS_M} m are compared and merged`, `${num(DUPLICATE_RADIUS_M, lang)} মিটারের মধ্যের রিপোর্ট মিলিয়ে একসাথে করা হয়`),
      kpi: tr("Share of reports merged into an existing issue", "পুরোনো সমস্যায় যুক্ত হওয়া রিপোর্টের হার"),
      result: k.duplicateMerge.of ? `${percent(k.duplicateMerge.pct, lang)} (${num(k.duplicateMerge.merged, lang)}/${num(k.duplicateMerge.of, lang)})` : "—",
      n: k.duplicateMerge.of,
    },
    {
      outcome: tr("Fewer false repair closures", "ভুলভাবে বন্ধ হওয়া মেরামত কম"),
      how: tr("Location, freshness and before/after checks; unsure goes to an officer", "অবস্থান, সময় আর আগে-পরের ছবি যাচাই; অনিশ্চিত হলে কর্মকর্তার কাছে"),
      kpi: tr("AI-approved repairs later overturned", "এআই-অনুমোদিত মেরামত পরে বাতিল"),
      result: k.falseClosure.of ? `${percent(k.falseClosure.pct, lang)} (${num(k.falseClosure.overturned, lang)}/${num(k.falseClosure.of, lang)})` : "—",
      n: k.falseClosure.of,
    },
    {
      outcome: tr("Accountable spending", "জবাবদিহিমূলক খরচ"),
      how: tr("Payment stays withheld until the repair is approved", "মেরামত অনুমোদন না হওয়া পর্যন্ত টাকা আটকে থাকে"),
      kpi: tr("Payments released with an approved repair", "অনুমোদিত মেরামতসহ ছাড় হওয়া টাকা"),
      result: k.paymentsBacked.of ? `${percent(k.paymentsBacked.pct, lang)} (${num(k.paymentsBacked.backed, lang)}/${num(k.paymentsBacked.of, lang)})` : "—",
      n: k.paymentsBacked.of,
    },
    {
      outcome: tr("Traceable decisions", "প্রতিটি সিদ্ধান্তের হিসাব"),
      how: tr("Every step is written to a tamper-evident log", "প্রতিটি ধাপ পরিবর্তন-ধরা-পড়া লগে লেখা হয়"),
      kpi: tr("Records with their audit entry", "অডিট এন্ট্রিসহ রেকর্ড"),
      result: k.auditCompletion.of ? `${percent(k.auditCompletion.pct, lang)} (${num(k.auditCompletion.recorded, lang)}/${num(k.auditCompletion.of, lang)})` : "—",
      n: k.auditCompletion.of,
    },
    {
      outcome: tr("Visible progress for citizens", "নাগরিকের চোখে অগ্রগতি"),
      how: tr("Public tracker, update log and per-area figures", "পাবলিক ট্র্যাকার, আপডেট লগ আর এলাকাভিত্তিক হিসাব"),
      kpi: tr("Citizens who can find their issue's status (user study)", "যারা নিজের সমস্যার অবস্থা খুঁজে পান (ব্যবহারকারী জরিপ)"),
      result: tr("Not measured (needs a pilot)", "মাপা হয়নি (পাইলট লাগবে)"),
      n: null,
    },
  ];

  return (
    <Card
      title={tr("Expected outcomes and their KPIs", "প্রত্যাশিত ফল আর তার মাপকাঠি")}
      note={tr("What each feature should change, and the live figure that shows it.", "প্রতিটি ফিচার কী বদলাবে, আর সেটা দেখানো সরাসরি সংখ্যা।")}
    >
      <table className="md-table">
        <thead>
          <tr>
            <th>{tr("Expected outcome", "প্রত্যাশিত ফল")}</th>
            <th>{tr("How CivicTrust does it", "CivicTrust কীভাবে করে")}</th>
            <th>{tr("KPI", "মাপকাঠি")}</th>
            <th className="num">{tr("Live result", "সরাসরি ফল")}</th>
            <th>{tr("Status", "অবস্থা")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.outcome}>
              <td>
                <strong style={{ fontWeight: 500 }}>{r.outcome}</strong>
              </td>
              <td>{r.how}</td>
              <td>{r.kpi}</td>
              <td className="num">{r.result}</td>
              <td>{r.n === null ? <span className="tag">{tr("Pilot", "পাইলট")}</span> : <Status n={r.n} lang={lang} tr={tr} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Reliability({ k, lang, tr }: { k: Kpis; lang: Lang; tr: Tr }) {
  const e = k.explanations;
  const rows: { what: string; result: string; n: number }[] = [
    {
      what: tr("Photo analysis answered (Gemini)", "ছবি বিশ্লেষণে উত্তর এসেছে (Gemini)"),
      result: `${percent(k.photoAnalysis.pct, lang)} (${tr(`${k.photoAnalysis.failed} failed`, `${num(k.photoAnalysis.failed, lang)}টি ব্যর্থ`)})`,
      n: k.photoAnalysis.of,
    },
    {
      what: tr(
        "Explanations written by Groq / by GLM (fallback) / by a local model (fallback) / none",
        "ব্যাখ্যা লিখেছে Groq / GLM (বিকল্প) / লোকাল মডেল (বিকল্প) / কেউ না",
      ),
      result: `${num(e.groq, lang)} / ${num(e.glm, lang)} / ${num(e.ollama, lang)} / ${num(e.none, lang)}`,
      n: e.of,
    },
    {
      what: tr("Duplicate comparisons that failed", "ব্যর্থ ডুপ্লিকেট তুলনা"),
      result: `${percent(k.duplicateCompare.pct, lang)} (${num(k.duplicateCompare.failures, lang)}/${num(k.duplicateCompare.of, lang)})`,
      n: k.duplicateCompare.of,
    },
    {
      what: tr("Repair checks where the AI failed (sent to an officer)", "যে মেরামত যাচাইয়ে এআই ব্যর্থ (কর্মকর্তার কাছে গেছে)"),
      result: `${percent(k.repairAi.pct, lang)} (${num(k.repairAi.failed, lang)}/${num(k.repairAi.of, lang)})`,
      n: k.repairAi.of,
    },
    {
      what: tr("Issues where an officer corrected the AI", "যেসব সমস্যায় কর্মকর্তা এআই সংশোধন করেছেন"),
      result: `${percent(k.officerCorrections.pct, lang)} (${num(k.officerCorrections.corrected, lang)}/${num(k.officerCorrections.of, lang)})`,
      n: k.officerCorrections.of,
    },
  ];

  return (
    <Card
      title={tr("AI reliability", "এআই-এর নির্ভরযোগ্যতা")}
      note={tr(
        "How often each AI step answered, and how often a person had to step in.",
        "প্রতিটি এআই ধাপ কতবার উত্তর দিয়েছে, আর কতবার মানুষকে হাত দিতে হয়েছে।",
      )}
    >
      <table className="md-table">
        <thead>
          <tr>
            <th>{tr("Measure", "মাপ")}</th>
            <th className="num">{tr("Live result", "সরাসরি ফল")}</th>
            <th>{tr("Status", "অবস্থা")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.what}>
              <td>{r.what}</td>
              <td className="num">{r.n ? r.result : "—"}</td>
              <td>
                <Status n={r.n} lang={lang} tr={tr} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const AUDIT_LABELS: Record<string, [string, string]> = {
  "report submitted": ["Report submitted", "রিপোর্ট জমা"],
  "AI assessment": ["AI assessment", "এআই মূল্যায়ন"],
  "duplicate merged": ["Duplicate merged", "ডুপ্লিকেট যুক্ত"],
  "officer correction": ["Officer correction", "কর্মকর্তার সংশোধন"],
  "work order created": ["Work order created", "কাজের আদেশ তৈরি"],
  "repair evidence": ["Repair evidence", "মেরামতের প্রমাণ"],
  "officer repair review": ["Officer repair review", "কর্মকর্তার মেরামত পর্যালোচনা"],
  "citizen feedback": ["Citizen feedback", "নাগরিকের মতামত"],
  "payment released": ["Payment released", "টাকা ছাড়"],
  "NGO offer": ["NGO offer", "এনজিও প্রস্তাব"],
};

function AuditDetail({ k, lang, tr }: { k: Kpis; lang: Lang; tr: Tr }) {
  return (
    <Card
      title={tr("Audit records by type", "ধরন অনুযায়ী অডিট রেকর্ড")}
      note={tr("Each stored record should have its entry in the audit log.", "সংরক্ষিত প্রতিটি রেকর্ডের অডিট লগে এন্ট্রি থাকার কথা।")}
    >
      <table className="md-table">
        <thead>
          <tr>
            <th>{tr("Record", "রেকর্ড")}</th>
            <th className="num">{tr("Logged / stored", "লগ হয়েছে / সংরক্ষিত")}</th>
          </tr>
        </thead>
        <tbody>
          {k.auditCompletion.detail.map((d) => {
            const label = AUDIT_LABELS[d.record];
            return (
              <tr key={d.record}>
                <td>{label ? tr(label[0], label[1]) : d.record}</td>
                <td className="num">
                  {num(d.recorded, lang)} / {num(d.expected, lang)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
