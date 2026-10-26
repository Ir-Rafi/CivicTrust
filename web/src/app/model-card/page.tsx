import { connection } from "next/server";
import { Suspense } from "react";
import { DocPage } from "@/components/doc-page";
import { modelNames } from "@/lib/env";
import { DUPLICATE_RADIUS_M, GPS_TARGET_ACCURACY_M, MAX_PHOTO_AGE_MINUTES, NEARBY_FACILITY_M, REPAIR_MAX_DISTANCE_M } from "@/lib/geo";
import { num, type Lang } from "@/lib/i18n";
import { REPAIR_CONFIDENCE } from "@/lib/repair-verdict";
import { AUTO_VERIFY_CONFIDENCE, MERGE_CONFIDENCE } from "@/lib/reports";
import { REPORT_BONUS_CAP } from "@/lib/severity";
import { getSession } from "@/lib/session";

// Every number and model name on this page comes from the code and configuration that run the
// app, so the card can't drift from what the app actually does.

export default function Page() {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <ModelCard />
    </Suspense>
  );
}

const pct = (v: number, lang: Lang) => `${num(Math.round(v * 100), lang)}%`;

async function ModelCard() {
  await connection();
  const { lang } = await getSession();
  const en = lang === "en";
  const m = modelNames();
  const n = (v: number) => num(v, lang);

  return (
    <DocPage
      eyebrow={en ? "Model card" : "মডেল কার্ড"}
      title={en ? "What the AI does, and where it can go wrong" : "এআই কী করে, আর কোথায় ভুল করতে পারে"}
      intro={
        en
          ? "CivicTrust uses AI at five points. None of them pays anyone or closes a job on its own: money and closure depend on checks the code enforces and on officers, and every AI decision is in the audit log. Every result shown in the app is computed live on real input."
          : "CivicTrust পাঁচটি জায়গায় এআই ব্যবহার করে। কোনোটিই নিজে থেকে কাউকে টাকা দেয় না বা কাজ বন্ধ করে না: টাকা আর কাজ বন্ধ হওয়া নির্ভর করে কোডের যাচাই আর কর্মকর্তাদের ওপর, আর এআই-এর প্রতিটি সিদ্ধান্ত অডিট লগে থাকে। অ্যাপে দেখানো প্রতিটি ফল আসল ইনপুটে সরাসরি হিসাব করা।"
      }
      sections={[
        {
          heading: en ? "1. Issue detector (photo analysis)" : "১. সমস্যা শনাক্তকারী (ছবি বিশ্লেষণ)",
          body: (
            <ul>
              <li>
                <strong>{en ? "Model" : "মডেল"}:</strong> Google Gemini <code>{m.vision}</code>
                {en ? ", called with storage disabled; no training on our data." : ", স্টোরেজ বন্ধ রেখে; আমাদের ডেটায় কোনো প্রশিক্ষণ নয়।"}
                {m.visionChain.length > 1 &&
                  (en
                    ? ` When it is overloaded, the backup ${m.visionChain.slice(1).join(", ")} answers instead; each result records which model produced it.`
                    : ` এটি ব্যস্ত থাকলে বিকল্প ${m.visionChain.slice(1).join(", ")} উত্তর দেয়; প্রতিটি ফলে কোন মডেল দিয়েছে তা লেখা থাকে।`)}
              </li>
              <li>
                <strong>{en ? "Input → output" : "ইনপুট → আউটপুট"}:</strong>{" "}
                {en
                  ? "one citizen photo → is it a civic problem, issue type (pothole, road crack, garbage, open drain, waterlogging, other), visual severity (minor, moderate, severe), confidence, visible hazards, and whether faces or number plates are readable."
                  : "নাগরিকের একটি ছবি → এটি নাগরিক সমস্যা কিনা, ধরন (গর্ত, ফাটল, ময়লা, খোলা ড্রেন, জলাবদ্ধতা, অন্যান্য), ছবিতে গুরুত্ব (সামান্য, মাঝারি, গুরুতর), নিশ্চয়তা, দৃশ্যমান ঝুঁকি, আর মুখ বা নম্বর প্লেট পড়া যায় কিনা।"}
              </li>
              <li>
                <strong>{en ? "How it is used" : "কীভাবে ব্যবহার হয়"}:</strong>{" "}
                {en
                  ? `photos that are not civic problems are not stored. At ${pct(AUTO_VERIFY_CONFIDENCE, lang)} confidence or more the issue is marked verified; below that it stays "reported" for an officer.`
                  : `নাগরিক সমস্যা নয় এমন ছবি সংরক্ষণ হয় না। ${pct(AUTO_VERIFY_CONFIDENCE, lang)} বা বেশি নিশ্চয়তায় সমস্যাটি যাচাইকৃত হয়; তার কম হলে কর্মকর্তার জন্য "রিপোর্ট" অবস্থায় থাকে।`}
              </li>
              <li>
                <strong>{en ? "Can go wrong" : "ভুল হতে পারে"}:</strong>{" "}
                {en
                  ? "night or monsoon photos (water hides depth), unusual angles, crack vs pothole, the size of a garbage pile. One photo is all it sees."
                  : "রাতের বা বর্ষার ছবি (পানিতে গভীরতা লুকায়), অস্বাভাবিক কোণ, ফাটল বনাম গর্ত, ময়লার স্তূপের আকার। এটি শুধু একটি ছবি দেখে।"}
              </li>
              <li>
                <strong>{en ? "Safeguard" : "সুরক্ষা"}:</strong>{" "}
                {en
                  ? "officers correct type, severity or score with a written reason; the original AI result and the correction both stay in the audit log."
                  : "কর্মকর্তা লিখিত কারণসহ ধরন, গুরুত্ব বা স্কোর সংশোধন করেন; এআই-এর মূল ফল আর সংশোধন দুটোই অডিট লগে থাকে।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "2. Severity score" : "২. জরুরিতার স্কোর",
          body: (
            <ul>
              <li>
                {en
                  ? "Not a machine-learning model: a published formula, so every point can be checked. Inputs: the photo's visual severity, the road type, distance to the nearest school or hospital"
                  : "এটি মেশিন-লার্নিং মডেল নয়: একটি প্রকাশিত সূত্র, যাতে প্রতিটি পয়েন্ট যাচাই করা যায়। ইনপুট: ছবিতে গুরুত্ব, রাস্তার ধরন, কাছের স্কুল বা হাসপাতালের দূরত্ব"}{" "}
                ({en ? "up to" : "সর্বোচ্চ"} {n(NEARBY_FACILITY_M)} {en ? "m" : "মিটার"}),{" "}
                {en ? "number of reports and days open." : "রিপোর্টের সংখ্যা আর কত দিন খোলা।"}
              </li>
              <li>
                {en
                  ? `Extra reports add at most +${n(REPORT_BONUS_CAP)} point, so areas with more smartphone users can't out-vote quieter ones.`
                  : `অতিরিক্ত রিপোর্ট সর্বোচ্চ +${n(REPORT_BONUS_CAP)} পয়েন্ট যোগ করে, যাতে বেশি স্মার্টফোন ব্যবহারকারীর এলাকা কম সরব এলাকাকে ছাড়িয়ে যেতে না পারে।`}
              </li>
              <li>
                {en
                  ? "The deadline follows from the score under the pilot policy; officers can override the score with a reason."
                  : "পাইলট নীতিমালা অনুযায়ী স্কোর থেকে সময়সীমা ঠিক হয়; কর্মকর্তা কারণসহ স্কোর বদলাতে পারেন।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "3. Duplicate filter" : "৩. ডুপ্লিকেট ফিল্টার",
          body: (
            <ul>
              <li>
                {en
                  ? `Open issues of the same type within ${n(DUPLICATE_RADIUS_M)} m are compared with the new photo by Gemini; at ${pct(MERGE_CONFIDENCE, lang)} confidence that it is the same problem, the report is added to that issue.`
                  : `একই ধরনের ${n(DUPLICATE_RADIUS_M)} মিটারের মধ্যের খোলা সমস্যার সঙ্গে জেমিনি নতুন ছবি তুলনা করে; একই সমস্যা বলে ${pct(MERGE_CONFIDENCE, lang)} নিশ্চয়তা হলে রিপোর্টটি সেই সমস্যায় যোগ হয়।`}
              </li>
              <li>
                {en
                  ? "Can go wrong: two different potholes close together, or the same one from a very different angle. If the comparison fails, the report is filed as a new issue rather than lost."
                  : "ভুল হতে পারে: কাছাকাছি দুটি আলাদা গর্ত, বা একই গর্ত খুব আলাদা কোণ থেকে। তুলনা ব্যর্থ হলে রিপোর্ট হারায় না, নতুন সমস্যা হিসেবে জমা হয়।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "4. Repair verifier" : "৪. মেরামত যাচাইকারী",
          body: (
            <ul>
              <li>
                {en
                  ? `Checks the code enforces first: the after-photo is taken within ${n(REPAIR_MAX_DISTANCE_M)} m of the issue, within ${n(MAX_PHOTO_AGE_MINUTES)} minutes, after the work order, with a measured (not typed-in) location.`
                  : `প্রথমে কোডের যাচাই: পরের ছবি সমস্যার ${n(REPAIR_MAX_DISTANCE_M)} মিটারের মধ্যে, ${n(MAX_PHOTO_AGE_MINUTES)} মিনিটের মধ্যে, কাজের আদেশের পরে, আর মাপা (হাতে লেখা নয়) অবস্থানে তোলা।`}
              </li>
              <li>
                {en
                  ? `Then Gemini compares the citizen's before-photo with the after-photo. Approval needs ${pct(REPAIR_CONFIDENCE, lang)} confidence that it is the same place and fixed; a confident "no" rejects; anything unsure goes to an officer. Only an approved repair makes payment eligible.`
                  : `তারপর জেমিনি নাগরিকের আগের ছবির সঙ্গে পরের ছবি তুলনা করে। অনুমোদনে একই জায়গা ও মেরামত হয়েছে বলে ${pct(REPAIR_CONFIDENCE, lang)} নিশ্চয়তা লাগে; নিশ্চিত "না" হলে বাতিল; অনিশ্চিত হলে কর্মকর্তার কাছে যায়। শুধু অনুমোদিত মেরামতেই অর্থ ছাড় সম্ভব।`}
              </li>
              <li>
                {en
                  ? "Can go wrong: a similar-looking spot, a partial or cosmetic repair, a staged photo. The phone reports its own location, which a determined person can fake; citizens can dispute any repair, which reopens it and withholds payment."
                  : "ভুল হতে পারে: দেখতে একই রকম অন্য জায়গা, আংশিক বা লোক দেখানো মেরামত, সাজানো ছবি। ফোন নিজের অবস্থান জানায়, যা কেউ চাইলে জাল করতে পারে; নাগরিক যেকোনো মেরামতে আপত্তি জানাতে পারেন, তাতে কাজ আবার খোলে আর অর্থ আটকে থাকে।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "5. Explanations and policy citations" : "৫. ব্যাখ্যা ও নীতিমালার উদ্ধৃতি",
          body: (
            <ul>
              <li>
                {en ? "One-line Bangla and English reason for each score: Groq " : "প্রতিটি স্কোরের এক লাইনের বাংলা ও ইংরেজি কারণ: Groq "}
                <code>{m.text}</code>
                {en ? ", with GLM " : ", বিকল্প GLM "}
                <code>{m.textFallback}</code>
                {en
                  ? " as fallback. They receive only computed facts (type, road, distances, score parts), never photos, and are told not to add anything. Display only: they decide nothing."
                  : "। এরা শুধু হিসাব করা তথ্য পায় (ধরন, রাস্তা, দূরত্ব, স্কোরের অংশ), কখনো ছবি নয়, আর কিছু যোগ না করার নির্দেশ থাকে। শুধু দেখানোর জন্য: এরা কোনো সিদ্ধান্ত নেয় না।"}
              </li>
              <li>
                {en ? "Deadline citations: Gemini embeddings " : "সময়সীমার উদ্ধৃতি: জেমিনি এমবেডিং "}
                <code>{m.embedding}</code>
                {en
                  ? " find the pilot policy clause behind each deadline. The deadline itself is computed by code; the search only cites the rule."
                  : " প্রতিটি সময়সীমার পেছনের নীতিমালার অংশ খুঁজে দেয়। সময়সীমা নিজে কোড হিসাব করে; খোঁজা শুধু নিয়মটি উদ্ধৃত করে।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "Evaluation" : "মূল্যায়ন",
          body: (
            <ul>
              <li>
                {en
                  ? "Accuracy is measured on a labelled set of real Dhanmondi photos and before/after pairs (pnpm eval:photos), and the live figures (duplicate rate, time to a ranked issue, false closures, audit completeness, AI success and fallback) come from the audit log (pnpm kpi)."
                  : "নির্ভুলতা মাপা হয় ধানমন্ডির আসল ছবি আর আগে/পরে জোড়ার লেবেল করা সেটে (pnpm eval:photos), আর সরাসরি হিসাব (ডুপ্লিকেট হার, র‍্যাঙ্ক হওয়া পর্যন্ত সময়, ভুল বন্ধ, অডিট সম্পূর্ণতা, এআই সাফল্য ও বিকল্প) আসে অডিট লগ থেকে (pnpm kpi)।"}
              </li>
              <li>
                {en
                  ? "Until the field set is collected, no accuracy figure is claimed. Published figures are labelled as measured, and targets as targets."
                  : "মাঠের সেট সংগ্রহ না হওয়া পর্যন্ত কোনো নির্ভুলতার সংখ্যা দাবি করা হয় না। প্রকাশিত সংখ্যা মাপা বলে, আর লক্ষ্য লক্ষ্য বলেই চিহ্নিত।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "Bias, privacy and limits" : "পক্ষপাত, গোপনীয়তা ও সীমাবদ্ধতা",
          body: (
            <ul>
              <li>
                {en
                  ? "Reports come from people with smartphones, so busy areas are heard more: the report bonus is capped, and per-area figures show where problems wait longest."
                  : "রিপোর্ট আসে স্মার্টফোন থাকা মানুষের কাছ থেকে, তাই ব্যস্ত এলাকার কথা বেশি শোনা যায়: রিপোর্টের বোনাস সীমিত, আর এলাকাভিত্তিক হিসাব দেখায় কোথায় সমস্যা সবচেয়ে বেশি দিন পড়ে থাকে।"}
              </li>
              <li>
                {en
                  ? "Road and school data exist only for the Dhanmondi pilot area; elsewhere the score cannot use them."
                  : "রাস্তা ও স্কুলের তথ্য শুধু ধানমন্ডি পাইলট এলাকার জন্য আছে; অন্য জায়গায় স্কোর এগুলো ব্যবহার করতে পারে না।"}
              </li>
              <li>
                {en
                  ? `Photos are never shown publicly; faces and number plates are flagged, and automatic blurring is planned. GPS is accepted as reported; the form aims for ±${n(GPS_TARGET_ACCURACY_M)} m and lets the citizen place the pin by hand, which is recorded.`
                  : `ছবি কখনো প্রকাশ্যে দেখানো হয় না; মুখ ও নম্বর প্লেট চিহ্নিত হয়, আর স্বয়ংক্রিয় ঝাপসা করা পরিকল্পনায় আছে। জিপিএস যেমন আসে তেমনই নেওয়া হয়; ফর্ম ±${n(GPS_TARGET_ACCURACY_M)} মিটার লক্ষ্য রাখে আর নাগরিককে নিজে পিন বসাতে দেয়, যা রেকর্ড থাকে।`}
              </li>
              <li>
                {en
                  ? "Prototype limits: no login (role switcher), free AI quotas, and model behaviour that can change when the provider updates the model."
                  : "প্রোটোটাইপের সীমা: লগইন নেই (ভূমিকা বদলের বোতাম), বিনামূল্যের এআই কোটা, আর প্রদানকারী মডেল হালনাগাদ করলে আচরণ বদলাতে পারে।"}
              </li>
            </ul>
          ),
        },
      ]}
    />
  );
}
