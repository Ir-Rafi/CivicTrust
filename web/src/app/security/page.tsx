import { Suspense } from "react";
import { DocPage } from "@/components/doc-page";
import { getSession } from "@/lib/session";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ height: 480 }} />}>
      <SecurityPage />
    </Suspense>
  );
}

async function SecurityPage() {
  const { lang } = await getSession();
  const en = lang === "en";
  return (
    <DocPage
      eyebrow={en ? "Responsible AI" : "দায়িত্বশীল এআই"}
      title={en ? "Security and responsible AI" : "নিরাপত্তা ও দায়িত্বশীল এআই"}
      intro={
        en
          ? "The safeguards built into the prototype, and what is still on the roadmap. Every AI result in the app is computed live on real input."
          : "প্রোটোটাইপে থাকা সুরক্ষা, এবং যা এখনো পরিকল্পনায় আছে। অ্যাপের প্রতিটি এআই ফল আসল ইনপুটে সরাসরি হিসাব করা।"
      }
      sections={[
        {
          heading: en ? "Access" : "প্রবেশাধিকার",
          body: (
            <ul>
              <li>
                {en
                  ? "No login in the prototype, by design, so judges can try every role in one click. Roles are a cookie checked on the server."
                  : "প্রোটোটাইপে ইচ্ছাকৃতভাবে লগইন নেই, যাতে বিচারকরা এক ক্লিকে প্রতিটি ভূমিকা দেখতে পারেন। ভূমিকা একটি কুকি, যা সার্ভারে যাচাই হয়।"}
              </li>
              <li>
                {en
                  ? "The database is closed to the browser: row-level security on every table, server-only access with a secret key."
                  : "ডেটাবেস ব্রাউজারের জন্য বন্ধ: প্রতিটি টেবিলে রো-লেভেল সিকিউরিটি, গোপন কী দিয়ে শুধু সার্ভার থেকে প্রবেশ।"}
              </li>
              <li>
                {en
                  ? "Machine access needs a secret: the read-only MCP server and the daily overdue check each require their own bearer token, and the optional local-model gateway checks a token and allows only one endpoint and one model."
                  : "যন্ত্রের প্রবেশে গোপন চাবি লাগে: শুধু-পড়ার MCP সার্ভার আর দৈনিক সময়সীমা যাচাই, প্রত্যেকটির আলাদা বেয়ারার টোকেন লাগে; ঐচ্ছিক লোকাল মডেলের গেটওয়ে টোকেন যাচাই করে আর শুধু একটি এন্ডপয়েন্ট ও একটি মডেল খোলা রাখে।"}
              </li>
              <li>{en ? "Roadmap: phone-OTP login and per-user permissions." : "পরিকল্পনা: ফোন-OTP লগইন ও ব্যবহারকারীভিত্তিক অনুমতি।"}</li>
            </ul>
          ),
        },
        {
          heading: en ? "Human oversight" : "মানুষের তত্ত্বাবধান",
          body: (
            <ul>
              <li>
                {en
                  ? "Officers can correct the AI's type, visual severity or score; a written reason is required."
                  : "কর্মকর্তা এআই-এর ধরন, ছবিতে গুরুত্ব বা স্কোর সংশোধন করতে পারেন; লিখিত কারণ বাধ্যতামূলক।"}
              </li>
              <li>
                {en
                  ? "Unsure repair verdicts go to an officer; the AI never auto-rejects a citizen's report on low confidence."
                  : "অনিশ্চিত মেরামতের রায় কর্মকর্তার কাছে যায়; কম নিশ্চয়তায় এআই কখনো নাগরিকের রিপোর্ট বাতিল করে না।"}
              </li>
              <li>
                {en
                  ? "Citizens can dispute a repair; a dispute reopens the job and withholds payment."
                  : "নাগরিক মেরামত নিয়ে আপত্তি করতে পারেন; আপত্তি কাজটি আবার খোলে এবং পরিশোধ আটকে রাখে।"}
              </li>
              <li>
                {en
                  ? "The Ask CivicTrust assistant can only read: assigning work, approving repairs and releasing payment stay with officers. Every question and the tools it used are logged."
                  : "Ask CivicTrust সহকারী শুধু পড়তে পারে: কাজ দেওয়া, মেরামত অনুমোদন আর পরিশোধ ছাড় কর্মকর্তার হাতেই থাকে। প্রতিটি প্রশ্ন আর ব্যবহৃত টুল লগে লেখা হয়।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "Tamper-evident audit log" : "পরিবর্তন-ধরা অডিট লগ",
          body: (
            <ul>
              <li>
                {en
                  ? "Reports, AI decisions, overrides, assignments, repair verdicts, disputes, payments, missed repair deadlines and assistant questions are appended to a SHA-256 hash chain."
                  : "রিপোর্ট, এআই সিদ্ধান্ত, সংশোধন, নিয়োগ, মেরামতের রায়, আপত্তি, পরিশোধ, পেরিয়ে যাওয়া মেরামতের সময়সীমা আর সহকারীর প্রশ্ন একটি SHA-256 হ্যাশ শৃঙ্খলে যুক্ত হয়।"}
              </li>
              <li>
                {en
                  ? "The table rejects updates and deletes; the chain is re-checked on every visit to the audit page."
                  : "টেবিলটি পরিবর্তন ও মুছে ফেলা প্রত্যাখ্যান করে; অডিট পৃষ্ঠায় প্রতিবার শৃঙ্খল আবার যাচাই হয়।"}
              </li>
              <li>
                {en ? "Payment can be released only after a verified repair; a database trigger enforces it." : "শুধু যাচাইকৃত মেরামতের পরেই অর্থ ছাড় করা যায়; ডেটাবেস ট্রিগার এটি নিশ্চিত করে।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "Fairness and privacy" : "ন্যায্যতা ও গোপনীয়তা",
          body: (
            <ul>
              <li>
                {en
                  ? "The citizen-report bonus in the severity score is capped at +1, so better-connected areas cannot out-vote quieter ones."
                  : "গুরুত্ব স্কোরে নাগরিক রিপোর্টের বোনাস সর্বোচ্চ +১, যাতে বেশি সংযুক্ত এলাকা কম সরব এলাকাকে ছাপিয়ে যেতে না পারে।"}
              </li>
              <li>
                {en
                  ? "Every score shows its components, so anyone can check the arithmetic."
                  : "প্রতিটি স্কোর তার উপাদান দেখায়, যাতে যে কেউ হিসাব মিলিয়ে দেখতে পারেন।"}
              </li>
              <li>
                {en
                  ? "The AI flags photos with readable faces or number plates. Automatic blurring is not built yet and is a finals item."
                  : "পড়া যায় এমন মুখ বা নম্বর প্লেট থাকলে এআই চিহ্নিত করে। স্বয়ংক্রিয় ঝাপসা করা এখনো তৈরি হয়নি, এটি ফাইনালের কাজ।"}
              </li>
            </ul>
          ),
        },
        {
          heading: en ? "Known limits" : "জানা সীমাবদ্ধতা",
          body: (
            <ul>
              <li>
                {en
                  ? "Accuracy figures will be published only once measured on the team's labelled set of real Dhaka photos."
                  : "দলের লেবেল করা ঢাকার আসল ছবির সেটে মাপার পরেই নির্ভুলতার হিসাব প্রকাশ করা হবে।"}
              </li>
              <li>
                {en
                  ? "OpenStreetMap tagging is imperfect; some 'hospitals' may be pharmacies. Officers can override."
                  : "OpenStreetMap-এর ট্যাগ নিখুঁত নয়; কিছু 'হাসপাতাল' আসলে ফার্মেসি হতে পারে। কর্মকর্তা সংশোধন করতে পারেন।"}
              </li>
              <li>{en ? "Pilot area only: Dhanmondi, Dhaka." : "শুধু পাইলট এলাকা: ধানমন্ডি, ঢাকা।"}</li>
            </ul>
          ),
        },
      ]}
    />
  );
}
