/**
 * Ask the officer assistant real questions against the live database and Groq. Read-only:
 * every tool only reads, and nothing is written to the audit log (the officer action does that).
 *
 *   pnpm smoke:agent                      # built-in questions
 *   pnpm smoke:agent "Which repairs are late?"
 */
import { askCivicTrust } from "@/lib/agent/assistant";

const QUESTIONS = [
  "Which repairs are past their deadline, and what has happened on those issues so far?",
  "What does the pilot policy say about the repair deadline for a severity 6 issue?",
  "কোন ঠিকাদার সময়মতো কাজ শেষ করছে? সংক্ষেপে বলুন।",
];

async function main() {
  const questions = process.argv.length > 2 ? process.argv.slice(2) : QUESTIONS;
  for (const q of questions) {
    console.log(`\nQ: ${q}`);
    try {
      const r = await askCivicTrust(q);
      console.log(`tools: ${r.tools.join(", ") || "none"} · ${r.ms} ms · ${r.model}`);
      console.log(r.answer);
    } catch (e) {
      console.log(`FAILED: ${e instanceof Error ? e.message : e}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
