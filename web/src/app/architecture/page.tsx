import { Suspense } from "react";
import { DocPage, Flow } from "@/components/doc-page";
import type { Lang } from "@/lib/i18n";
import { getSession } from "@/lib/session";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <Architecture />
    </Suspense>
  );
}

const FLOW = {
  en: [
    { title: "Report", detail: "Camera photo, GPS and capture time from the citizen's phone." },
    { title: "Analyse", detail: "Gemini vision: issue type, visual severity, confidence, hazards." },
    { title: "Prioritise", detail: "Transparent 1–10 formula using OpenStreetMap roads, schools and hospitals." },
    { title: "Assign", detail: "Deadline from severity, with the policy clause found by RAG." },
    { title: "Verify", detail: "GPS ±15 m, fresh capture, and Gemini before/after comparison." },
    { title: "Publish", detail: "Payment gate, citizen confirmation, public scorecards." },
  ],
  bn: [
    { title: "রিপোর্ট", detail: "নাগরিকের ফোন থেকে ক্যামেরার ছবি, জিপিএস ও তোলার সময়।" },
    { title: "বিশ্লেষণ", detail: "জেমিনি ভিশন: সমস্যার ধরন, ছবিতে গুরুত্ব, নিশ্চয়তা, ঝুঁকি।" },
    { title: "অগ্রাধিকার", detail: "OpenStreetMap-এর রাস্তা, স্কুল ও হাসপাতাল দিয়ে স্বচ্ছ ১–১০ সূত্র।" },
    { title: "নিয়োগ", detail: "গুরুত্ব অনুযায়ী সময়সীমা, RAG দিয়ে খুঁজে পাওয়া নীতির ধারাসহ।" },
    { title: "যাচাই", detail: "জিপিএস ±১৫ মিটার, নতুন ছবি, এবং জেমিনি দিয়ে আগে/পরে তুলনা।" },
    { title: "প্রকাশ", detail: "পরিশোধের শর্ত, নাগরিকের নিশ্চিতকরণ, পাবলিক স্কোরকার্ড।" },
  ],
};

async function Architecture() {
  const { lang } = await getSession();
  const en = lang === "en";
  return (
    <DocPage
      eyebrow={en ? "System design" : "সিস্টেম ডিজাইন"}
      title={en ? "Architecture" : "আর্কিটেকচার"}
      intro={
        en
          ? "One core loop: Report → Analyse → Prioritise → Assign → Verify → Publish. AI decides type, urgency, duplicates and closure; officers can override every AI decision, and every step is written to a hash-chained audit log."
          : "একটি মূল প্রবাহ: রিপোর্ট → বিশ্লেষণ → অগ্রাধিকার → নিয়োগ → যাচাই → প্রকাশ। এআই ধরন, জরুরিতা, ডুপ্লিকেট ও কাজ বন্ধের সিদ্ধান্ত নেয়; কর্মকর্তা যেকোনো এআই সিদ্ধান্ত বদলাতে পারেন, এবং প্রতিটি ধাপ হ্যাশ-শৃঙ্খলিত অডিট লগে লেখা হয়।"
      }
      sections={[
        { heading: en ? "Pipeline" : "প্রবাহ", body: <Flow steps={FLOW[lang as Lang]} /> },
        {
          heading: en ? "Layers" : "স্তর",
          body: (
            <ul>
              <li>
                <strong>UI</strong> — {en ? "Next.js 16 (App Router), mobile-first, Bangla by default." : "Next.js 16 (App Router), মোবাইল-প্রথম, ডিফল্ট ভাষা বাংলা।"}
              </li>
              <li>
                <strong>{en ? "App logic" : "অ্যাপ লজিক"}</strong> —{" "}
                {en ? "Server actions only; the browser never talks to the database." : "শুধু সার্ভার অ্যাকশন; ব্রাউজার কখনো সরাসরি ডেটাবেসে যায় না।"}
              </li>
              <li>
                <strong>AI</strong> —{" "}
                {en
                  ? "Gemini for vision (report analysis, duplicate check, repair verification) and embeddings; Groq for Bangla/English explanations, with GLM as automatic fallback."
                  : "ভিশনের জন্য জেমিনি (রিপোর্ট বিশ্লেষণ, ডুপ্লিকেট যাচাই, মেরামত যাচাই) ও এমবেডিং; বাংলা/ইংরেজি ব্যাখ্যার জন্য Groq, বিকল্প হিসেবে GLM।"}
              </li>
              <li>
                <strong>{en ? "Knowledge" : "জ্ঞানভান্ডার"}</strong> —{" "}
                {en ? "pgvector search over the pilot repair policy (RAG), cited on every work order." : "পাইলট মেরামত নীতিমালার উপর pgvector সার্চ (RAG), প্রতিটি কাজের আদেশে উল্লেখিত।"}
              </li>
              <li>
                <strong>{en ? "Data" : "ডেটা"}</strong> —{" "}
                {en ? "Supabase Postgres + PostGIS, private photo storage, append-only audit log." : "Supabase Postgres + PostGIS, ব্যক্তিগত ছবি স্টোরেজ, শুধু-যোগযোগ্য অডিট লগ।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "Model selection" : "মডেল নির্বাচন",
          body: (
            <ul>
              <li>
                {en
                  ? "Gemini: strong vision on day one with no training data; called with storage disabled."
                  : "জেমিনি: প্রশিক্ষণ ডেটা ছাড়াই প্রথম দিন থেকে ভালো ভিশন; স্টোরেজ বন্ধ রেখে ব্যবহার।"}
              </li>
              <li>{en ? "Groq: fast text generation for explanations." : "Groq: ব্যাখ্যার জন্য দ্রুত টেক্সট তৈরি।"}</li>
              <li>
                {en
                  ? "All models are swappable by configuration. Finals roadmap: self-hosted YOLO + CLIP so photos stay on city infrastructure."
                  : "সব মডেল কনফিগারেশন দিয়ে বদলানো যায়। ফাইনালের পরিকল্পনা: নিজস্ব সার্ভারে YOLO + CLIP, যাতে ছবি সিটির অবকাঠামোতেই থাকে।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "Prompt and context engineering" : "প্রম্পট ও কনটেক্সট",
          body: (
            <ul>
              <li>{en ? "Strict JSON schemas for every AI call." : "প্রতিটি এআই কলে কঠোর JSON স্কিমা।"}</li>
              <li>
                {en
                  ? "Explanations are written only from computed facts (score components, nearby places), not free guesses."
                  : "ব্যাখ্যা শুধু হিসাব করা তথ্য (স্কোরের উপাদান, কাছের স্থান) থেকে লেখা হয়, অনুমান থেকে নয়।"}
              </li>
              <li>
                {en
                  ? "Refusal path: photos that are not a civic problem are rejected and not stored. Low-confidence repairs go to an officer."
                  : "প্রত্যাখ্যানের পথ: নাগরিক সমস্যা নয় এমন ছবি বাতিল হয় ও সংরক্ষিত হয় না। কম নিশ্চয়তার মেরামত কর্মকর্তার কাছে যায়।"}
              </li>
            </ul>
          ),
        },
      ]}
    />
  );
}
