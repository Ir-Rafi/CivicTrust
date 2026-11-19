import assert from "node:assert/strict";
import { test } from "node:test";
import { isBanglaScript } from "./bangla";

test("isBanglaScript accepts Bangla lines with Bangla digits and punctuation", () => {
  assert.equal(isBanglaScript("আবাসিক এলাকার রাস্তায় বড় গর্ত, মাত্র ৮৫ মিটার দূরেই একটা স্কুল।"), true);
  assert.equal(isBanglaScript("হাসপাতালের ২৩০ মিটারের মধ্যে ময়লা জমে আছে; ২ জন জানিয়েছেন।"), true);
});

test("isBanglaScript rejects English letters, English digits and empty lines", () => {
  // A real answer from a small local model (Qwen 2.5): English letters inside a Bangla word.
  assert.equal(isBanglaScript("বিদyalয়ের সামনে গর্ত"), false, "English letters inside a Bangla word");
  assert.equal(isBanglaScript("Road 7-এ বড় গর্ত"), false, "an English word");
  assert.equal(isBanglaScript("৭ নম্বর রোডে 85 মিটার"), false, "English digits");
  assert.equal(isBanglaScript("   "), false);
});
