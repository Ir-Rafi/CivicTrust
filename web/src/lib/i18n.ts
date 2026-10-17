export const LANGS = ["bn", "en"] as const;
export type Lang = (typeof LANGS)[number];

export function isLang(value: unknown): value is Lang {
  return value === "bn" || value === "en";
}

const en = {
  appName: "CivicTrust",
  tagline: "Report it. AI ranks it. The city fixes it. AI checks the fix.",
  chooseRole: "Try the prototype as",
  switchRole: "Role",
  language: "বাংলা",
  roles: {
    citizen: "Citizen",
    officer: "Ward officer",
    contractor: "Contractor",
    ngo: "NGO / volunteers",
    public: "Public portal",
  },
  roleBlurb: {
    citizen: "Snap a pothole or garbage pile, get an instant AI assessment, track the fix.",
    officer: "Work the AI-ranked queue, correct the AI, assign contractors with deadlines.",
    contractor: "See work orders and upload proof. AI closes the job only if it's fixed.",
    ngo: "Claim open issues to fix for free.",
    public: "Open vs. fixed issues per ward, fix times, before/after gallery. No login.",
  },
  nav: {
    architecture: "Architecture",
    data: "Data",
    security: "Security",
    audit: "Audit",
  },
  status: {
    reported: "Reported",
    verified: "Verified",
    assigned: "Assigned",
    in_progress: "In progress",
    fixed: "Fixed",
    confirmed: "Confirmed",
    disputed: "Disputed",
    rejected: "Rejected",
  },
  buildingNote: "This screen is being built.",
};

type Dict = typeof en;

const bn: Dict = {
  appName: "সিভিকট্রাস্ট",
  tagline: "রিপোর্ট করুন। এআই অগ্রাধিকার দেয়। সিটি মেরামত করে। এআই মেরামত যাচাই করে।",
  chooseRole: "প্রোটোটাইপটি ব্যবহার করুন",
  switchRole: "ভূমিকা",
  language: "English",
  roles: {
    citizen: "নাগরিক",
    officer: "ওয়ার্ড কর্মকর্তা",
    contractor: "ঠিকাদার",
    ngo: "এনজিও / স্বেচ্ছাসেবক",
    public: "পাবলিক পোর্টাল",
  },
  roleBlurb: {
    citizen: "গর্ত বা ময়লার স্তূপের ছবি তুলুন, সাথে সাথে এআই মূল্যায়ন পান, মেরামত অনুসরণ করুন।",
    officer: "এআই-সাজানো তালিকা দেখুন, এআই সংশোধন করুন, সময়সীমাসহ ঠিকাদার নিয়োগ দিন।",
    contractor: "কাজের আদেশ দেখুন ও প্রমাণ আপলোড করুন। মেরামত হলে তবেই এআই কাজ বন্ধ করে।",
    ngo: "খোলা সমস্যা বিনামূল্যে সমাধানের জন্য দাবি করুন।",
    public: "ওয়ার্ডভিত্তিক খোলা ও সমাধান হওয়া সমস্যা, মেরামতের সময়, আগে/পরে ছবি। লগইন লাগে না।",
  },
  nav: {
    architecture: "আর্কিটেকচার",
    data: "ডেটা",
    security: "নিরাপত্তা",
    audit: "অডিট",
  },
  status: {
    reported: "রিপোর্ট হয়েছে",
    verified: "যাচাই হয়েছে",
    assigned: "নিয়োগ হয়েছে",
    in_progress: "কাজ চলছে",
    fixed: "মেরামত হয়েছে",
    confirmed: "নিশ্চিত",
    disputed: "আপত্তি",
    rejected: "বাতিল",
  },
  buildingNote: "এই স্ক্রিনটি তৈরি হচ্ছে।",
};

export function dict(lang: Lang): Dict {
  return lang === "bn" ? bn : en;
}
