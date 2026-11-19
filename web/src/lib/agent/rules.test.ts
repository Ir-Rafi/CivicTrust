import assert from "node:assert/strict";
import { test } from "node:test";
import { checkQuestion, isRateLimit, plainAnswer, QUESTION_MAX, replyLanguage, toolsUsed } from "./rules";

test("checkQuestion trims, collapses spaces and enforces the length limits", () => {
  assert.deepEqual(checkQuestion("  Which   repairs are late? "), { ok: true, question: "Which repairs are late?" });
  assert.deepEqual(checkQuestion("   "), { ok: false, error: "empty" });
  assert.deepEqual(checkQuestion(undefined), { ok: false, error: "empty" });
  assert.deepEqual(checkQuestion("hi"), { ok: false, error: "too_short" });
  assert.deepEqual(checkQuestion("x".repeat(QUESTION_MAX + 1)), { ok: false, error: "too_long" });
  assert.equal(checkQuestion("কোন মেরামত দেরিতে?").ok, true, "Bangla questions are accepted");
});

test("toolsUsed lists each tool once, in first-use order, across steps", () => {
  const steps = [
    { toolCalls: [{ payload: { toolName: "list_overdue_repairs" } }, { payload: { toolName: "get_issue_timeline" } }] },
    { toolCalls: [{ payload: { toolName: "get_issue_timeline" } }] },
    { toolCalls: [] },
    {},
  ];
  assert.deepEqual(toolsUsed(steps), ["list_overdue_repairs", "get_issue_timeline"]);
  assert.deepEqual(toolsUsed([]), []);
});

test("replyLanguage follows the question's script", () => {
  assert.equal(replyLanguage("Which repairs are late?"), "en");
  assert.equal(replyLanguage("কোন মেরামত দেরিতে?"), "bn");
  assert.equal(replyLanguage("#CT-16 এর অবস্থা কী?"), "bn", "an issue ID does not make it English");
  assert.equal(replyLanguage("Is #CT-16 late? দেরি?"), "en");
});

test("plainAnswer removes Markdown and odd citation brackets but keeps lists", () => {
  assert.equal(plainAnswer("**#CT-16** – late\n- WO-17 【Severity bands】\n\n\n## Note\ndone  "), "#CT-16 – late\n- WO-17 (Severity bands)\n\nNote\ndone");
});

test("plainAnswer drops made-up issue labels and keeps real ones", () => {
  assert.equal(plainAnswer("- Contractor A: on-time rate 0 (#CT‑none)"), "- Contractor A: on-time rate 0");
  assert.equal(plainAnswer("Within 7 days [#CT‑policy Severity bands]."), "Within 7 days.");
  assert.equal(plainAnswer("See #CT-16 and (#CT-3)."), "See #CT-16 and (#CT-3).");
});

test("isRateLimit recognises 429s and quota messages only", () => {
  assert.equal(isRateLimit(Object.assign(new Error("Too Many Requests"), { statusCode: 429 })), true);
  assert.equal(isRateLimit(new Error("Rate limit reached for model openai/gpt-oss-120b")), true);
  assert.equal(isRateLimit(new Error("Invalid tool arguments")), false);
});
