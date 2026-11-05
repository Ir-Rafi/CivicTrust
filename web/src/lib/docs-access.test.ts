import assert from "node:assert/strict";
import { test } from "node:test";
import { docsAccess, parseDocsTime } from "./docs-access";

const at = (iso: string) => new Date(iso).getTime();

test("parseDocsTime reads dates and times in Dhaka time unless an offset is given", () => {
  assert.equal(parseDocsTime("2026-11-15", false)?.toISOString(), "2026-11-14T18:00:00.000Z");
  assert.equal(parseDocsTime("2026-11-15", true)?.toISOString(), "2026-11-15T17:59:59.000Z");
  assert.equal(parseDocsTime("2026-11-15T09:30", false)?.toISOString(), "2026-11-15T03:30:00.000Z");
  assert.equal(parseDocsTime("2026-11-15T09:30Z", false)?.toISOString(), "2026-11-15T09:30:00.000Z");
  assert.equal(parseDocsTime("2026-02-30", false), null, "dates that do not exist are rejected");
  assert.equal(parseDocsTime("15/11/2026", false), null);
  assert.equal(parseDocsTime("", false), null);
  assert.equal(parseDocsTime(undefined, false), null);
});

test("docs are open by default and can be switched off", () => {
  assert.deepEqual(docsAccess({}, at("2026-11-05T00:00:00Z")), { open: true, until: null });
  for (const off of ["false", "0", "OFF", " no "]) assert.equal(docsAccess({ DOCS_ENABLED: off }, Date.now()).open, false);
  assert.equal(docsAccess({ DOCS_ENABLED: "true" }, Date.now()).open, true);
});

test("a window opens and closes the page at its edges, including the whole last day", () => {
  const env = { DOCS_FROM: "2026-11-01", DOCS_UNTIL: "2026-11-15" };
  assert.deepEqual(docsAccess(env, at("2026-10-31T17:59:59Z")).open, false);
  assert.equal(docsAccess(env, at("2026-10-31T18:00:00Z")).open, true, "00:00 on 1 Nov in Dhaka");
  assert.equal(docsAccess(env, at("2026-11-15T17:59:59Z")).open, true, "23:59:59 on 15 Nov in Dhaka");
  const after = docsAccess(env, at("2026-11-15T18:00:00Z"));
  assert.equal(after.open, false);
  assert.equal(!after.open && after.reason, "ended");
  const before = docsAccess(env, at("2026-10-20T00:00:00Z"));
  assert.equal(!before.open && before.reason, "not_yet");
});

test("an unparseable window value is ignored rather than hiding the page", () => {
  assert.equal(docsAccess({ DOCS_UNTIL: "next week" }, Date.now()).open, true);
});
