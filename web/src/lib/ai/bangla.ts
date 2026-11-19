/**
 * True when the text uses only Bangla script, Bangla digits, spaces and common punctuation.
 * Small local models sometimes mix English letters or digits into a Bangla word; such a line
 * is discarded rather than shown to citizens.
 */
export function isBanglaScript(text: string): boolean {
  // Bengali block, plus the Bangla full stops । and ॥ (Unicode keeps them outside the Bengali
  // block) and the zero-width (non-)joiners.
  return text.trim().length > 0 && /^[ঀ-৿।॥‌‍\s.,;:!?'"()\-–—/%৳]+$/u.test(text);
}
