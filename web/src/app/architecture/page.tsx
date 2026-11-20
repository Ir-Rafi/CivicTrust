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
          ? "One core loop: Report → Analyse → Prioritise → Assign → Verify → Publish. AI reads each photo, spots duplicates and compares repair photos; urgency comes from a published formula, and a job closes only when the code's checks pass or an officer approves it. Officers can override every AI result, and every step is written to a hash-chained audit log."
          : "একটি মূল প্রবাহ: রিপোর্ট → বিশ্লেষণ → অগ্রাধিকার → নিয়োগ → যাচাই → প্রকাশ। এআই প্রতিটি ছবি পড়ে, ডুপ্লিকেট খোঁজে আর মেরামতের ছবি মেলায়; জরুরিতা আসে একটি প্রকাশিত সূত্র থেকে, আর কাজ বন্ধ হয় শুধু কোডের যাচাই পার হলে বা কর্মকর্তা অনুমোদন দিলে। কর্মকর্তা যেকোনো এআই ফল বদলাতে পারেন, এবং প্রতিটি ধাপ হ্যাশ-শৃঙ্খলিত অডিট লগে লেখা হয়।"
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
                  ? "Gemini for vision (report analysis, duplicate check, repair verification) and embeddings; Groq for Bangla/English explanations, with GLM and an optional local model (Ollama) as fallbacks. The Ask CivicTrust officer assistant is a Mastra agent on Groq that can only call read-only tools."
                  : "ভিশনের জন্য জেমিনি (রিপোর্ট বিশ্লেষণ, ডুপ্লিকেট যাচাই, মেরামত যাচাই) ও এমবেডিং; বাংলা/ইংরেজি ব্যাখ্যার জন্য Groq, বিকল্প হিসেবে GLM আর ঐচ্ছিক লোকাল মডেল (Ollama)। Ask CivicTrust কর্মকর্তার সহকারী Groq-এ চলা একটি Mastra এজেন্ট, যা শুধু-পড়ার টুল ডাকতে পারে।"}
              </li>
              <li>
                <strong>{en ? "Knowledge" : "জ্ঞানভান্ডার"}</strong> —{" "}
                {en ? "pgvector search over the pilot repair policy (RAG), cited on every work order." : "পাইলট মেরামত নীতিমালার উপর pgvector সার্চ (RAG), প্রতিটি কাজের আদেশে উল্লেখিত।"}
              </li>
              <li>
                <strong>{en ? "Data" : "ডেটা"}</strong> —{" "}
                {en ? "Supabase Postgres + PostGIS, private photo storage, append-only audit log." : "Supabase Postgres + PostGIS, ব্যক্তিগত ছবি স্টোরেজ, শুধু-যোগযোগ্য অডিট লগ।"}
              </li>
              <li>
                <strong>{en ? "Integrations" : "সংযোগ"}</strong> —{" "}
                {en
                  ? "A read-only MCP server (/api/mcp) for AI assistants, and a daily overdue-repair check run by Vercel Cron or an n8n workflow."
                  : "এআই সহকারীর জন্য শুধু-পড়ার MCP সার্ভার (/api/mcp), আর Vercel Cron বা n8n ওয়ার্কফ্লো দিয়ে চালানো দৈনিক সময়সীমা যাচাই।"}
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
              <li>{en ? "Groq: fast text generation for explanations and the officer assistant." : "Groq: ব্যাখ্যা আর কর্মকর্তার সহকারীর জন্য দ্রুত টেক্সট তৈরি।"}</li>
              <li>
                {en
                  ? "Free-tier resilience: requests rotate over a pool of API keys, and if the main vision model is busy, backup Gemini models start one after another; the first answer wins."
                  : "ফ্রি-টিয়ারে টিকে থাকা: অনুরোধগুলো কয়েকটি API কী-তে ঘুরে ঘুরে যায়, আর মূল ভিশন মডেল ব্যস্ত থাকলে বিকল্প জেমিনি মডেল একের পর এক শুরু হয়; যে আগে উত্তর দেয় সেটিই নেওয়া হয়।"}
              </li>
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
