import { Suspense } from "react";
import { DocPage } from "@/components/doc-page";
import { getSession } from "@/lib/session";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <DataPage />
    </Suspense>
  );
}

async function DataPage() {
  const { lang } = await getSession();
  const en = lang === "en";
  return (
    <DocPage
      eyebrow={en ? "Data and sovereignty" : "ডেটা ও সার্বভৌমত্ব"}
      title={en ? "Data sources and lineage" : "ডেটার উৎস ও গতিপথ"}
      intro={
        en
          ? "Where every piece of data comes from, where it is stored, and which outside services see it."
          : "প্রতিটি ডেটা কোথা থেকে আসে, কোথায় রাখা হয়, এবং কোন বাইরের সেবা তা দেখে।"
      }
      sections={[
        {
          heading: en ? "Sources and licences" : "উৎস ও লাইসেন্স",
          body: (
            <ul>
              <li>
                <strong>OpenStreetMap</strong> —{" "}
                {en
                  ? "roads, schools, hospitals and clinics in the Dhanmondi pilot area (ODbL, attributed in the footer). Some mis-tagged places are filtered by name; officers can override the rest."
                  : "ধানমন্ডি পাইলট এলাকার রাস্তা, স্কুল, হাসপাতাল ও ক্লিনিক (ODbL, ফুটারে উল্লেখিত)। কিছু ভুল-ট্যাগ করা স্থান নাম দিয়ে বাদ দেওয়া হয়; বাকিগুলো কর্মকর্তা সংশোধন করতে পারেন।"}
              </li>
              <li>
                <strong>{en ? "Pilot repair policy" : "পাইলট মেরামত নীতিমালা"}</strong> —{" "}
                {en
                  ? "written by the team for the prototype; it is not official government policy."
                  : "প্রোটোটাইপের জন্য দলের লেখা; এটি সরকারি নীতি নয়।"}
              </li>
              <li>
                <strong>{en ? "Citizen and repair photos" : "নাগরিক ও মেরামতের ছবি"}</strong> —{" "}
                {en ? "taken in the app, with consent." : "অ্যাপে তোলা, সম্মতিসহ।"}
              </li>
              <li>
                <strong>{en ? "Ward boundaries" : "ওয়ার্ড সীমানা"}</strong> —{" "}
                {en
                  ? "pending a licensed source. Until then the public portal groups the pilot area as one zone and says so."
                  : "লাইসেন্সকৃত উৎসের অপেক্ষায়। ততদিন পাবলিক পোর্টাল পাইলট এলাকাকে একটি অঞ্চল হিসেবে দেখায় এবং তা উল্লেখ করে।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "Storage" : "সংরক্ষণ",
          body: (
            <ul>
              <li>
                {en
                  ? "Supabase Postgres with PostGIS and pgvector. The current project is hosted in the Sydney region; moving to Singapore or self-hosting is on the roadmap."
                  : "PostGIS ও pgvector-সহ Supabase Postgres। বর্তমান প্রকল্পটি সিডনি অঞ্চলে; সিঙ্গাপুরে সরানো বা নিজস্ব সার্ভারে নেওয়া পরিকল্পনায় আছে।"}
              </li>
              <li>
                {en
                  ? "Photos are in a private bucket and shown through short-lived signed links."
                  : "ছবি ব্যক্তিগত বাকেটে থাকে এবং স্বল্পমেয়াদি স্বাক্ষরিত লিংকে দেখানো হয়।"}
              </li>
              <li>
                {en
                  ? "Photos are re-encoded in the browser before upload, which drops EXIF metadata (including the phone's GPS tags)."
                  : "আপলোডের আগে ব্রাউজারে ছবি নতুন করে এনকোড হয়, ফলে EXIF মেটাডেটা (ফোনের জিপিএস ট্যাগসহ) মুছে যায়।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "External AI services" : "বাইরের এআই সেবা",
          body: (
            <ul>
              <li>
                <strong>Google Gemini</strong> —{" "}
                {en ? "receives photos, called with storage disabled." : "ছবি পায়, স্টোরেজ বন্ধ রেখে ব্যবহার।"}
              </li>
              <li>
                <strong>Groq</strong> ({en ? "GLM as fallback" : "বিকল্প GLM"}) —{" "}
                {en ? "receives text facts only (score components, place names), never photos." : "শুধু টেক্সট তথ্য পায় (স্কোরের উপাদান, স্থানের নাম), কখনো ছবি নয়।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "What the public sees" : "জনসাধারণ যা দেখে",
          body: (
            <ul>
              <li>{en ? "Each problem's type, road and nearest landmark, and whether it is reported, assigned or fixed, with a plain-language update log." : "প্রতিটি সমস্যার ধরন, রাস্তা ও কাছের পরিচিত জায়গা, আর সেটি রিপোর্ট, দায়িত্ব দেওয়া না মেরামত হয়েছে, সঙ্গে সহজ ভাষার আপডেট লগ।"}</li>
              <li>{en ? "Area-level counts, fix times and payment totals." : "এলাকাভিত্তিক সংখ্যা, মেরামতের সময় ও পরিশোধের মোট।"}</li>
              <li>{en ? "No reporter names, no exact pins." : "কোনো রিপোর্টকারীর নাম বা সঠিক অবস্থান নয়।"}</li>
              <li>
                {en ? "Exact locations are shown to officers and the assigned crew only." : "সঠিক অবস্থান শুধু কর্মকর্তা ও নিযুক্ত দল দেখেন।"}
              </li>
            </ul>
          ),
        },
      ]}
    />
  );
}
