import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyFailure, parseList, PoolExhaustedError, ProviderPool, restMs, retryAfterMs } from "./provider-pool";

const fail = (status: number, message: string) => Object.assign(new Error(`${status} ${message}`), { status });

test("classifyFailure separates key, model and fatal problems", () => {
  assert.equal(classifyFailure(fail(429, "Resource has been exhausted")), "key");
  assert.equal(classifyFailure(fail(403, "PERMISSION_DENIED")), "key");
  assert.equal(classifyFailure(fail(503, "This model is currently experiencing high demand")), "model");
  assert.equal(classifyFailure(fail(404, "model is not found")), "model");
  assert.equal(classifyFailure(fail(400, "Invalid argument")), "fatal");
  assert.equal(classifyFailure(new Error("Request timed out: TimeoutError: The operation was aborted due to timeout")), "model");
});

test("with a backup model, the main model gets only its share of the time", async () => {
  let t = 0;
  const pool = new ProviderPool(["k0"], () => t);
  const given: Record<string, number> = {};
  const result = await pool.run(["slow", "backup"], 30_000, async (_k, model, timeoutMs) => {
    given[model] = timeoutMs;
    if (model === "slow") {
      t += timeoutMs; // hangs for its whole share
      throw new Error("Request timed out");
    }
    return "ok";
  });
  assert.equal(given.slow, 15_000);
  assert.equal(given.backup, 15_000);
  assert.equal(result.model, "backup");
});

test("retryAfterMs reads the provider's own wait", () => {
  assert.equal(retryAfterMs("429 Rate limit exceeded (limit: 20 requests per day). Please retry in 16h19m39s or upgrade"), (16 * 3600 + 19 * 60 + 39) * 1000);
  assert.equal(retryAfterMs("Please retry in 41.5s."), 41_500);
  assert.equal(retryAfterMs('{"retryDelay": "58840s"}'), 58_840_000);
  assert.equal(retryAfterMs("Please retry in 40h0m0s"), 24 * 3_600_000, "capped at a day");
  assert.equal(retryAfterMs("429 Resource has been exhausted"), null);
  assert.equal(restMs("key", "Please retry in 2m0s"), 120_000);
  assert.equal(restMs("key", "The Gemini API free tier is not available for this project"), 6 * 3_600_000);
});

test("a quota error rests the key only for that model; a project error rests it for all models", async () => {
  const pool = new ProviderPool(["k0", "k1"]);
  const first: string[] = [];
  const run = (model: string, failing: (key: string, model: string) => Error | null) =>
    pool.run([model], Date.now() + 10_000, async (key, m) => {
      first.push(key);
      const err = failing(key, m);
      if (err) throw err;
      return "ok";
    });
  const quota = (key: string, m: string) => (key === "k0" && m === "m1" ? fail(429, "20 requests per day. Please retry in 16h0m0s") : null);
  await run("m1", quota); // cursor k0: k0 is over quota on m1, k1 answers
  await run("m1", quota); // cursor k1
  first.length = 0;
  await run("m2", quota); // cursor k0 again: k0 is fine for m2
  assert.equal(first[0], "k0");
  await run("m2", quota); // cursor k1
  first.length = 0;
  await run("m1", quota); // cursor k0, but k0 rests for m1, so k1 goes first
  assert.equal(first[0], "k1");

  const billing = new ProviderPool(["k0", "k1"]);
  const tried: string[] = [];
  await billing.run(["m1"], Date.now() + 10_000, async (key) => {
    tried.push(key);
    if (key === "k0") throw fail(403, "The Gemini API free tier is not available for this project");
    return "ok";
  });
  await billing.run(["m1"], Date.now() + 10_000, async () => "ok"); // cursor k1
  tried.length = 0;
  await billing.run(["m2"], Date.now() + 10_000, async (key) => (tried.push(key), "ok")); // cursor k0, rested for all models
  assert.equal(tried[0], "k1");
});

test("parseList keeps order and drops blanks and repeats", () => {
  assert.deepEqual(parseList("a, b", undefined, "b,c ,, d"), ["a", "b", "c", "d"]);
  assert.deepEqual(parseList("", undefined), []);
});

test("a rate-limited key falls through to the next key on the same model", async () => {
  const pool = new ProviderPool(["k0", "k1"]);
  const calls: string[] = [];
  const result = await pool.run(["m1", "m2"], Date.now() + 10_000, async (key, model) => {
    calls.push(`${key}/${model}`);
    if (key === "k0") throw fail(429, "quota");
    return "ok";
  });
  assert.deepEqual(calls, ["k0/m1", "k1/m1"]);
  assert.equal(result.model, "m1");
  assert.equal(result.keyIndex, 1);
});

test("an overloaded model falls through to the next model, not the next key", async () => {
  const pool = new ProviderPool(["k0", "k1"]);
  const calls: string[] = [];
  const result = await pool.run(["m1", "m2"], Date.now() + 10_000, async (key, model) => {
    calls.push(`${key}/${model}`);
    if (model === "m1") throw fail(503, "high demand");
    return "ok";
  });
  assert.deepEqual(calls, ["k0/m1", "k0/m2"]);
  assert.equal(result.model, "m2");
});

test("a resting model is tried last on the next request", async () => {
  let t = 0;
  const pool = new ProviderPool(["k0"], () => t);
  await pool.run(["m1", "m2"], 10_000, async (_k, model) => {
    if (model === "m1") throw fail(503, "high demand");
    return "ok";
  });
  const order: string[] = [];
  await pool.run(["m1", "m2"], 10_000, async (_k, model) => (order.push(model), "ok"));
  assert.deepEqual(order, ["m2"]);
  t = 3 * 60_000; // rest is over: the primary model comes first again
  const later: string[] = [];
  await pool.run(["m1", "m2"], 4 * 60_000, async (_k, model) => (later.push(model), "ok"));
  assert.deepEqual(later, ["m1"]);
});

test("keys are used round-robin", async () => {
  const pool = new ProviderPool(["k0", "k1", "k2"]);
  const used: number[] = [];
  for (let i = 0; i < 4; i++) used.push((await pool.run(["m"], Date.now() + 10_000, async () => "ok")).keyIndex);
  assert.deepEqual(used, [0, 1, 2, 0]);
});

test("a fatal error is thrown at once, and running out of options keeps the last error", async () => {
  const pool = new ProviderPool(["k0", "k1"]);
  await assert.rejects(
    pool.run(["m"], Date.now() + 10_000, async () => {
      throw fail(400, "bad request");
    }),
    /400 bad request/,
  );
  await assert.rejects(
    pool.run(["m"], Date.now() + 10_000, async () => {
      throw fail(429, "quota");
    }),
    (e: unknown) => e instanceof PoolExhaustedError && e.attempts.length === 2 && /429 quota/.test(e.message),
  );
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("hedged: a healthy main model answers alone", async () => {
  const pool = new ProviderPool(["k0"]);
  const started: string[] = [];
  const result = await pool.hedged(["main", "backup"], Date.now() + 5_000, async (_k, model) => (started.push(model), "ok"), 200);
  assert.equal(result.model, "main");
  await sleep(250);
  assert.deepEqual(started, ["main"]);
});

test("hedged: a hanging main model is overtaken by the backup, then rests", async () => {
  const pool = new ProviderPool(["k0"]);
  const t0 = Date.now();
  const result = await pool.hedged(["main", "backup"], Date.now() + 5_000, async (_k, model) => {
    if (model === "main") await sleep(2_000);
    return model;
  }, 100);
  assert.equal(result.model, "backup");
  assert.ok(Date.now() - t0 < 1_000, "the backup did not wait for the main model");
  const next: string[] = [];
  await pool.hedged(["main", "backup"], Date.now() + 5_000, async (_k, model) => (next.push(model), "ok"), 100);
  assert.deepEqual(next, ["backup"]);
});

test("hedged: a main model that fails fast starts the backup at once", async () => {
  const pool = new ProviderPool(["k0"]);
  const t0 = Date.now();
  const result = await pool.hedged(["main", "backup"], Date.now() + 5_000, async (_k, model) => {
    if (model === "main") throw fail(503, "high demand");
    return "ok";
  }, 2_000);
  assert.equal(result.model, "backup");
  assert.ok(Date.now() - t0 < 1_000);
});

test("hedged: models start one after another, and the first to answer wins", async () => {
  const pool = new ProviderPool(["k0"]);
  const t0 = Date.now();
  const result = await pool.hedged(["m1", "m2", "m3"], Date.now() + 5_000, async (_k, model) => {
    if (model !== "m3") await sleep(2_000);
    return model;
  }, 100);
  assert.equal(result.model, "m3");
  assert.ok(Date.now() - t0 < 1_000, "m3 started after two short waits, not after the others gave up");
  const next: string[] = [];
  await pool.hedged(["m1", "m2", "m3"], Date.now() + 5_000, async (_k, model) => (next.push(model), "ok"), 100);
  assert.deepEqual(next, ["m3"], "the models that lost the race rest, so m3 goes first next time");
});

test("hedged: a slow but working model keeps the whole time and is not cut off", async () => {
  const pool = new ProviderPool(["k0"]);
  const given: Record<string, number> = {};
  const result = await pool.hedged(["m1", "m2"], Date.now() + 5_000, async (_k, model, timeoutMs) => {
    given[model] = timeoutMs;
    await sleep(model === "m1" ? 300 : 1_000);
    return model;
  }, 50);
  assert.equal(result.model, "m1");
  assert.ok(given.m1 > 4_000, `m1 had ${given.m1} ms`);
});

test("hedged: when every model is briefly busy, the round is repeated while time is left", async () => {
  const pool = new ProviderPool(["k0"]);
  let calls = 0;
  const result = await pool.hedged(
    ["m1", "m2"],
    Date.now() + 5_000,
    async (_k, model) => {
      calls++;
      if (calls <= 2) throw fail(503, `${model} high demand`); // the whole first round fails
      return model;
    },
    50,
    100,
    { max: 3, pauseMs: 50, minWindowMs: 500 },
  );
  assert.equal(calls, 3);
  assert.equal(result.model, "m1");
});

test("hedged: keys out of quota for a model are skipped while another model can answer", async () => {
  const pool = new ProviderPool(["k0", "k1", "k2"]);
  const tried: string[] = [];
  const call = async (key: string, model: string) => {
    tried.push(`${key}/${model}`);
    if (model === "main") throw fail(429, "20 requests per day. Please retry in 10h0m0s");
    return model;
  };
  await pool.hedged(["main", "backup"], Date.now() + 5_000, call, 1_000);
  assert.equal(tried.filter((c) => c.endsWith("/main")).length, 3, "first call learns that every key is out of quota");
  tried.length = 0;
  const result = await pool.hedged(["main", "backup"], Date.now() + 5_000, call, 1_000);
  assert.equal(result.model, "backup");
  assert.equal(tried.filter((c) => c.endsWith("/main")).length, 0, "the next call does not try those keys again");
});

test("hedged: when every model fails, the last error is thrown", async () => {
  const pool = new ProviderPool(["k0"]);
  await assert.rejects(
    pool.hedged(["main", "backup"], Date.now() + 5_000, async (_k, model) => {
      throw fail(503, `${model} busy`);
    }, 100),
    /backup busy/,
  );
});

test("no attempt starts without enough time left", async () => {
  const pool = new ProviderPool(["k0"]);
  await assert.rejects(pool.run(["m"], Date.now() + 100, async () => "ok"), PoolExhaustedError);
});
