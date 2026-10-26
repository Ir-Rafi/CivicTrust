// Key pool and model fallback for an AI provider, with no SDK dependency so it can be tested.
//
// - A key that is rate-limited, out of quota or rejected ("key" failure) is rested and the next
//   key is tried with the same model. Quota is per Google Cloud project, so extra keys only help
//   when they come from different projects.
// - A model that is overloaded or unavailable ("model" failure) is rested and the next model in
//   the list is tried. More keys don't help here: every key reaches the same busy model.
// - Anything else (bad request, invalid output, timeout) is thrown straight away.
// Keys are used round-robin so each project's per-minute quota is spread evenly.

export type FailureKind = "key" | "model" | "fatal";

export function classifyFailure(e: unknown): FailureKind {
  const raw = (e as { status?: unknown } | null)?.status;
  const status = typeof raw === "number" ? raw : null;
  const msg = e instanceof Error ? e.message : String(e);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg)) return "key";
  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(msg)) return "key";
  if (status === 404 || /model .*not (found|supported)/i.test(msg)) return "model";
  if ((status !== null && status >= 500) || /UNAVAILABLE|high demand|overloaded/i.test(msg)) return "model";
  // A model that doesn't answer in its share of the time is treated like an overloaded one.
  if (/timed? ?out|TimeoutError|aborted due to timeout/i.test(msg) || (e as { name?: string } | null)?.name === "TimeoutError") return "model";
  return "fatal";
}

/** Split a comma- or whitespace-separated setting into unique, non-empty entries, in order. */
export function parseList(...values: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const v of values) for (const item of (v ?? "").split(/[\s,]+/)) if (item && !out.includes(item)) out.push(item);
  return out;
}

/** A key problem that affects every model: its project needs billing, or the key is invalid. */
function projectWide(message: string): boolean {
  return /free tier is not available|set up billing|API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(message);
}

/** The provider's own wait, e.g. "Please retry in 16h19m39s" or `"retryDelay": "41s"`, capped at a day. */
export function retryAfterMs(message: string): number | null {
  const m = message.match(/retry (?:in|after)\s+((?:\d+(?:\.\d+)?\s*[hms]\s*)+)/i) ?? message.match(/retryDelay"?\s*:\s*"?((?:\d+(?:\.\d+)?[hms])+)/i);
  if (!m) return null;
  let ms = 0;
  for (const [, n, unit] of m[1].matchAll(/(\d+(?:\.\d+)?)\s*([hms])/gi)) {
    ms += Number(n) * (unit.toLowerCase() === "h" ? 3_600_000 : unit.toLowerCase() === "m" ? 60_000 : 1000);
  }
  return ms > 0 ? Math.min(Math.round(ms), 24 * 3_600_000) : null;
}

/** How long to skip a key or model after a failure: the provider's own wait when it gives one. */
export function restMs(kind: Exclude<FailureKind, "fatal">, message: string): number {
  if (kind === "model") return 2 * 60_000;
  // A key whose project needs billing, or that is invalid, won't start working within minutes.
  if (projectWide(message)) return 6 * 60 * 60_000;
  return retryAfterMs(message) ?? (/per.?day|daily/i.test(message) ? 30 * 60_000 : 60_000);
}

export type Attempt = { model: string; keyIndex: number; kind: FailureKind; error: string };

export class PoolExhaustedError extends Error {
  constructor(readonly attempts: Attempt[]) {
    const last = attempts.at(-1)?.error ?? "no key or model was available";
    super(`${last} (tried ${attempts.length} key/model combination${attempts.length === 1 ? "" : "s"})`);
    this.name = "PoolExhaustedError";
  }
}

export class ProviderPool {
  private cursor = 0;
  private readonly restingUntil = new Map<string, number>();

  constructor(
    private readonly keys: string[],
    private readonly now: () => number = Date.now,
  ) {
    if (keys.length === 0) throw new Error("the key pool is empty");
  }

  get size(): number {
    return this.keys.length;
  }

  /** Items that are not resting come first; resting ones stay as a last resort. Order is otherwise kept. */
  private ready<T>(items: T[], ids: (item: T) => string[]): T[] {
    const t = this.now();
    const resting = (item: T) => ids(item).some((id) => (this.restingUntil.get(id) ?? 0) > t);
    return [...items.filter((i) => !resting(i)), ...items.filter(resting)];
  }

  /**
   * Run `call` with the first key/model pair that works, within `deadlineMs` (absolute time).
   * Stops when less than `minAttemptMs` is left for another try.
   */
  async run<T>(
    models: string[],
    deadlineMs: number,
    call: (key: string, model: string, timeoutMs: number) => Promise<T>,
    minAttemptMs = 1500,
  ): Promise<{ value: T; model: string; keyIndex: number; attempts: Attempt[] }> {
    const attempts: Attempt[] = [];
    const start = this.cursor++ % this.keys.length;
    const rotated = [...this.keys.slice(start), ...this.keys.slice(0, start)].map((key) => ({ key, index: this.keys.indexOf(key) }));

    const chain = this.ready(models, (m) => [`model:${m}`]);
    for (const [position, model] of chain.entries()) {
      // A key rests either for every model (project problem) or only for this model (quota is per model).
      for (const { key, index } of this.ready(rotated, (k) => [`key:${k.index}`, `key:${k.index}:${model}`])) {
        const left = deadlineMs - this.now();
        if (left < minAttemptMs) throw new PoolExhaustedError(attempts);
        // While a backup model remains, this one gets an even share of the time, so a model that
        // hangs instead of failing fast still leaves the backup time to answer.
        const share = Math.max(minAttemptMs, Math.floor(left / (chain.length - position)));
        try {
          return { value: await call(key, model, share), model, keyIndex: index, attempts };
        } catch (e) {
          const kind = classifyFailure(e);
          const error = e instanceof Error ? e.message : String(e);
          attempts.push({ model, keyIndex: index, kind, error });
          if (kind === "fatal") throw e;
          const id = kind === "model" ? `model:${model}` : projectWide(error) ? `key:${index}` : `key:${index}:${model}`;
          this.restingUntil.set(id, this.now() + restMs(kind, error));
          if (kind === "model") break;
        }
      }
    }
    throw new PoolExhaustedError(attempts);
  }

  /**
   * Staggered model fallback: the first model starts at once, the next one after `hedgeMs` (or as
   * soon as every running model has failed), and so on. Each model keeps the whole remaining time,
   * so a slow but working model is never cut off, and the first answer wins. Each model is used at
   * most once per round (each has its own quota). Models that started earlier than the winner and
   * were still running are rested like overloaded ones; resting models start last.
   * When every model has failed but enough time is left, the round is repeated after a short
   * pause: "high demand" spikes are usually brief. At most `rounds.max` rounds.
   */
  hedged<T>(
    models: string[],
    deadlineMs: number,
    call: (key: string, model: string, timeoutMs: number) => Promise<T>,
    hedgeMs: number,
    minAttemptMs = 1500,
    rounds: { max: number; pauseMs: number; minWindowMs: number } = { max: 3, pauseMs: 1500, minWindowMs: 6000 },
  ): Promise<{ value: T; model: string; keyIndex: number; attempts: Attempt[] }> {
    return new Promise((resolve, reject) => {
      const startedAt = new Map<string, number>();
      const running = new Set<string>();
      const errors: unknown[] = [];
      let order: string[] = [];
      let next = 0;
      let round = 0;
      let done = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const startRound = () => {
        round++;
        order = this.ready(models, (m) => [`model:${m}`]);
        next = 0;
        startNext();
      };

      const startNext = () => {
        clearTimeout(timer);
        if (done || next >= order.length) return;
        const model = order[next++];
        startedAt.set(model, this.now());
        running.add(model);
        this.run([model], deadlineMs, call, minAttemptMs).then(
          (result) => {
            running.delete(model);
            if (done) return;
            done = true;
            clearTimeout(timer);
            const wonAt = startedAt.get(model)!;
            for (const other of running) {
              if (startedAt.get(other)! < wonAt) this.restingUntil.set(`model:${other}`, this.now() + restMs("model", "slow"));
            }
            resolve(result);
          },
          (e) => {
            running.delete(model);
            errors.push(e);
            if (done) return;
            if (next < order.length) startNext();
            else if (running.size === 0) {
              if (round < rounds.max && deadlineMs - this.now() >= rounds.minWindowMs + rounds.pauseMs) {
                timer = setTimeout(startRound, rounds.pauseMs);
              } else {
                done = true;
                reject(errors.at(-1));
              }
            }
          },
        );
        if (next < order.length) timer = setTimeout(startNext, hedgeMs);
      };
      startRound();
    });
  }
}
