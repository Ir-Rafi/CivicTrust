"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { num, type Lang } from "@/lib/i18n";

// Interactive charts for /impact. Every value arrives from computeKpis() on the server (the same
// figures as the tables below, which stay as the accessible table view); nothing is computed
// here except layout: percentages of a row, and the histogram bins of the triage times.

export type SampleState = "none" | "early" | "measured";

export type RateRow = {
  key: string;
  label: string;
  /** Shown under the label, e.g. "lower is better". */
  hint?: string;
  part: number;
  whole: number;
  pct: number | null;
  status: SampleState;
};

/** One AI step split into: handled by the main path / backup or a person stepped in / failed. */
export type ReliabilityRow = {
  key: string;
  label: string;
  primary: number;
  backup: number;
  failed: number;
  /** What each part means for this step, for the tooltip. */
  names: { primary: string; backup: string | null; failed: string };
  status: SampleState;
};

export type AuditRow = { label: string; recorded: number; expected: number };

export type ImpactChartsCopy = {
  outcomesTitle: string;
  outcomesNote: string;
  reliabilityTitle: string;
  reliabilityNote: string;
  triageTitle: string;
  triageNote: string;
  auditTitle: string;
  auditNote: string;
  legendPrimary: string;
  legendBackup: string;
  legendFailed: string;
  legendLogged: string;
  legendMissing: string;
  noData: string;
  early: string;
  measured: string;
  reports: string;
  seconds: string;
  median: string;
  p90: string;
  ofTotal: string;
  notYetRecorded: string;
  tableHint: string;
};

export type ImpactChartsProps = {
  lang: Lang;
  copy: ImpactChartsCopy;
  rates: RateRow[];
  reliability: ReliabilityRow[];
  triage: { samplesMs: number[]; medianMs: number | null; p90Ms: number | null };
  audit: AuditRow[];
};

const SERIES = { primary: "var(--viz-1)", backup: "var(--viz-2)", failed: "var(--viz-3)" } as const;
type SeriesKey = keyof typeof SERIES;

const AXIS_TICK = { fill: "var(--viz-ink-2)", fontSize: 12 };
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Bars grow in once, unless the viewer asked the OS for less motion. */
function useAnimation() {
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => true);
  return { isAnimationActive: !reduced, animationDuration: 600, animationEasing: "ease-out" as const };
}

export function ImpactCharts({ lang, copy, rates, reliability, triage, audit }: ImpactChartsProps) {
  return (
    <div className="viz viz-grid">
      <ChartCard title={copy.outcomesTitle} note={copy.outcomesNote} wide={false}>
        <RatesChart lang={lang} copy={copy} rows={rates} />
      </ChartCard>
      <ChartCard title={copy.reliabilityTitle} note={copy.reliabilityNote} wide={false}>
        <ReliabilityChart lang={lang} copy={copy} rows={reliability} />
      </ChartCard>
      <ChartCard title={copy.triageTitle} note={copy.triageNote} wide={false}>
        <TriageChart lang={lang} copy={copy} {...triage} />
      </ChartCard>
      <ChartCard title={copy.auditTitle} note={copy.auditNote} wide={false}>
        <AuditChart lang={lang} copy={copy} rows={audit} />
      </ChartCard>
      <p className="label-small viz-table-hint">{copy.tableHint}</p>
    </div>
  );
}

function ChartCard({ title, note, children, wide }: { title: string; note: string; children: ReactNode; wide: boolean }) {
  return (
    <section className={`card viz-card${wide ? " viz-wide" : ""}`}>
      <div className="viz-card-head">
        <h2 className="headline-small">{title}</h2>
        <p className="label-small">{note}</p>
      </div>
      {children}
    </section>
  );
}

function StatusChip({ status, n, lang, copy }: { status: SampleState; n: number; lang: Lang; copy: ImpactChartsCopy }) {
  if (status === "none") return <span className="tag">{copy.noData}</span>;
  if (status === "early") return <span className="tag warning">{`${copy.early} · n=${num(n, lang)}`}</span>;
  return <span className="tag verified">{`${copy.measured} · n=${num(n, lang)}`}</span>;
}

function Legend({
  items,
  focus,
  onFocus,
}: {
  items: { key: SeriesKey; label: string }[];
  focus: SeriesKey | null;
  onFocus: (key: SeriesKey | null) => void;
}) {
  return (
    <ul className="viz-legend" onMouseLeave={() => onFocus(null)}>
      {items.map((it) => (
        <li key={it.key}>
          <button
            type="button"
            className={focus && focus !== it.key ? "is-dim" : undefined}
            aria-pressed={focus === it.key}
            onMouseEnter={() => onFocus(it.key)}
            onFocus={() => onFocus(it.key)}
            onBlur={() => onFocus(null)}
            onClick={() => onFocus(focus === it.key ? null : it.key)}
          >
            <span className="viz-swatch" style={{ background: SERIES[it.key] }} aria-hidden />
            {it.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function TooltipBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="viz-tooltip" role="status">
      <div className="viz-tooltip-title">{title}</div>
      {children}
    </div>
  );
}

function TooltipLine({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="viz-tooltip-line">
      {color ? <span className="viz-swatch" style={{ background: color }} aria-hidden /> : null}
      <span className="viz-tooltip-label">{label}</span>
      <span className="viz-tooltip-value">{value}</span>
    </div>
  );
}

type TickProps = { x?: number; y?: number; payload?: { value: string } };

/** Category label on the left of a horizontal bar chart, with an optional muted second line. */
function CategoryTick({ x = 0, y = 0, payload, sub, compact = false }: TickProps & { sub: Map<string, string>; compact?: boolean }) {
  const label = payload?.value ?? "";
  const second = sub.get(label);
  if (compact) {
    return (
      <text x={8} y={y - 15} textAnchor="start" className="viz-cat">
        {label}
        {second ? <tspan className="viz-cat-sub">{` · ${second}`}</tspan> : null}
      </text>
    );
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-10} y={second ? -3 : 4} textAnchor="end" className="viz-cat">
        {label}
      </text>
      {second ? (
        <text x={-10} y={12} textAnchor="end" className="viz-cat-sub">
          {second}
        </text>
      ) : null}
    </g>
  );
}

/** Right-hand value column: every row shows its figure, even when the bar has zero length. */
function ValueTick({ x = 0, y = 0, payload, values }: TickProps & { values: Map<string, { text: string; muted: boolean }> }) {
  const v = values.get(payload?.value ?? "");
  if (!v) return null;
  return (
    <text x={x + 10} y={y + 4} textAnchor="start" className={v.muted ? "viz-value-muted" : "viz-value"}>
      {v.text}
    </text>
  );
}

function valueAxis(values: Map<string, { text: string; muted: boolean }>, width = 84) {
  return (
    <YAxis
      yAxisId="value"
      orientation="right"
      type="category"
      dataKey="label"
      width={width}
      axisLine={false}
      tickLine={false}
      tick={(props) => <ValueTick {...(props as TickProps)} values={values} />}
    />
  );
}

const pctText = (v: number, lang: Lang) => `${num(v, lang, 1)}%`;

/** Width of the plot, so narrow cards (phones) can put each label above its bar. */
function usePlotWidth() {
  const [width, setWidth] = useState(0);
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, compact: width > 0 && width < 520 };
}

/** Row geometry for the horizontal bar charts: labels left of the bars, or above them when compact. */
function rowLayout(compact: boolean, rows: number, rowHeight = 48) {
  return compact
    ? { height: 28 + rows * (rowHeight + 14), labelWidth: 1, valueWidth: 64, gap: 24, top: 18 }
    : { height: 36 + rows * rowHeight, labelWidth: 176, valueWidth: 84, gap: 14, top: 4 };
}

/** Click an entry to outline it; click it again to clear. Shared by all four charts. The click is
 *  read from the bar that was hit (not the hover state), so taps on touch screens pick the right row. */
function useSelection() {
  const [selected, setSelected] = useState<number | null>(null);
  const toggle = (index: number) => setSelected((current) => (current === index ? null : index));
  return { selected, toggle };
}

type ShapeProps = { x?: number; y?: number; width?: number; height?: number; index?: number };

/** The outline drawn around the selected entry; nothing for the others. */
function SelectionRing({ x = 0, y = 0, width = 0, height = 0 }: ShapeProps) {
  if (width <= 0 || height <= 0) return null;
  return <rect x={x - 3} y={y - 3} width={width + 6} height={height + 6} rx={7} className="viz-selection" />;
}

/** Overlay bar, drawn last over each row: the click target for the whole row, and the ring when selected. */
function selectionBar(selected: number | null, toggle: (index: number) => void, dataKey: string | (() => number), barSize: number) {
  return (
    <Bar
      dataKey={dataKey}
      barSize={barSize}
      fill="transparent"
      isAnimationActive={false}
      activeBar={false}
      legendType="none"
      tooltipType="none"
      onClick={(_entry: unknown, index: number) => toggle(index)}
      shape={(props: unknown) => {
        const p = props as ShapeProps;
        return (
          <g>
            <rect x={p.x} y={p.y} width={Math.max(0, p.width ?? 0)} height={Math.max(0, p.height ?? 0)} fill="transparent" />
            {p.index === selected ? <SelectionRing {...p} /> : null}
          </g>
        );
      }}
    />
  );
}

/* ---------- 1. Outcome KPIs: one bar per rate on a 0–100% scale ---------- */

function RatesChart({ lang, copy, rows }: { lang: Lang; copy: ImpactChartsCopy; rows: RateRow[] }) {
  const ANIMATION = useAnimation();
  const data = rows.map((r) => ({ ...r, value: r.pct ?? 0, display: r.pct === null ? copy.noData : pctText(r.pct, lang) }));
  const sub = new Map(rows.filter((r) => r.hint).map((r) => [r.label, r.hint as string]));
  const { ref, compact } = usePlotWidth();
  const { selected, toggle } = useSelection();
  // A narrow value column has no room for "No data yet"; the dash says the same, the tooltip spells it out.
  const values = new Map(data.map((r) => [r.label, { text: r.pct === null && compact ? "—" : r.display, muted: r.pct === null }]));
  const L = rowLayout(compact, rows.length);

  return (
    <div className="viz-plot" role="img" aria-label={copy.outcomesTitle} ref={ref}>
      <ResponsiveContainer width="100%" height={L.height}>
        <BarChart data={data} layout="vertical" margin={{ top: L.top, right: 4, bottom: 4, left: 8 }} barCategoryGap={L.gap} barGap={-18}>
          <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v: number) => `${num(v, lang)}%`}
            tick={AXIS_TICK}
            axisLine={{ stroke: "var(--viz-axis)" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={L.labelWidth}
            axisLine={false}
            tickLine={false}
            tick={(props) => <CategoryTick {...(props as TickProps)} sub={sub} compact={compact} />}
          />
          {valueAxis(values, L.valueWidth)}
          <Tooltip
            cursor={{ fill: "var(--viz-cursor)" }}
            content={(p) => {
              const row = (p.payload?.[0]?.payload ?? null) as (typeof data)[number] | null;
              if (!p.active || !row) return null;
              return (
                <TooltipBox title={row.label}>
                  <TooltipLine color={SERIES.primary} label={row.display} value={row.whole ? `${num(row.part, lang)} ${copy.ofTotal} ${num(row.whole, lang)}` : ""} />
                  <div className="viz-tooltip-foot">
                    <StatusChip status={row.status} n={row.whole} lang={lang} copy={copy} />
                  </div>
                </TooltipBox>
              );
            }}
          />
          <Bar dataKey={() => 100} fill="var(--viz-track)" barSize={18} radius={4} isAnimationActive={false} activeBar={false} legendType="none" tooltipType="none" />
          <Bar dataKey="value" fill={SERIES.primary} barSize={18} radius={[0, 4, 4, 0]} activeBar={{ fill: "var(--viz-1-strong)" }} {...ANIMATION} />
          {selectionBar(selected, toggle, () => 100, 18)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- 2. AI reliability: 100% stacked bar per AI step ---------- */

function ReliabilityChart({ lang, copy, rows }: { lang: Lang; copy: ImpactChartsCopy; rows: ReliabilityRow[] }) {
  const ANIMATION = useAnimation();
  const [focus, setFocus] = useState<SeriesKey | null>(null);
  const data = rows.map((r) => {
    const total = r.primary + r.backup + r.failed;
    const share = (v: number) => (total ? (v / total) * 100 : 0);
    // Only the last visible segment gets the rounded data-end; the baseline stays square.
    const last: SeriesKey | null = r.failed ? "failed" : r.backup ? "backup" : r.primary ? "primary" : null;
    return { ...r, total, primaryPct: share(r.primary), backupPct: share(r.backup), failedPct: share(r.failed), last };
  });
  const { ref, compact } = usePlotWidth();
  const { selected, toggle } = useSelection();
  const values = new Map(data.map((r) => [r.label, r.total ? { text: `n=${num(r.total, lang)}`, muted: false } : { text: compact ? "—" : copy.noData, muted: true }]));
  const L = rowLayout(compact, rows.length);
  const keys: SeriesKey[] = ["primary", "backup", "failed"];
  const radius = (row: (typeof data)[number], key: SeriesKey): [number, number, number, number] => (row.last === key ? [0, 4, 4, 0] : [0, 0, 0, 0]);
  const opacity = (key: SeriesKey) => (focus && focus !== key ? 0.22 : 1);

  return (
    <>
      <Legend
        items={[
          { key: "primary", label: copy.legendPrimary },
          { key: "backup", label: copy.legendBackup },
          { key: "failed", label: copy.legendFailed },
        ]}
        focus={focus}
        onFocus={setFocus}
      />
      <div className="viz-plot" role="img" aria-label={copy.reliabilityTitle} ref={ref}>
        <ResponsiveContainer width="100%" height={L.height}>
          <BarChart data={data} layout="vertical" margin={{ top: L.top, right: 4, bottom: 4, left: 8 }} barCategoryGap={L.gap} barGap={-18}>
            <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
            <XAxis
              type="number"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v: number) => `${num(v, lang)}%`}
              tick={AXIS_TICK}
              axisLine={{ stroke: "var(--viz-axis)" }}
              tickLine={false}
            />
            <YAxis type="category" dataKey="label" width={L.labelWidth} axisLine={false} tickLine={false} tick={(props) => <CategoryTick {...(props as TickProps)} sub={new Map()} compact={compact} />} />
            {valueAxis(values, L.valueWidth)}
            <Tooltip
              cursor={{ fill: "var(--viz-cursor)" }}
              content={(p) => {
                const row = (p.payload?.[0]?.payload ?? null) as (typeof data)[number] | null;
                if (!p.active || !row) return null;
                return (
                  <TooltipBox title={row.label}>
                    {row.total === 0 ? (
                      <TooltipLine label={copy.noData} value="" />
                    ) : (
                      keys
                        .filter((k) => k !== "backup" || row.names.backup)
                        .map((k) => (
                          <TooltipLine
                            key={k}
                            color={SERIES[k]}
                            label={(k === "backup" ? row.names.backup : row.names[k]) ?? ""}
                            value={`${num(row[k], lang)} · ${pctText(row[`${k}Pct`], lang)}`}
                          />
                        ))
                    )}
                    <div className="viz-tooltip-foot">
                      <StatusChip status={row.status} n={row.total} lang={lang} copy={copy} />
                    </div>
                  </TooltipBox>
                );
              }}
            />
            <Bar dataKey={() => 100} fill="var(--viz-track)" barSize={18} radius={4} isAnimationActive={false} activeBar={false} legendType="none" tooltipType="none" />
            {keys.map((k) => (
              <Bar
                key={k}
                dataKey={`${k}Pct`}
                name={k}
                stackId="share"
                fill={SERIES[k]}
                fillOpacity={opacity(k)}
                stroke="var(--viz-surface)"
                strokeWidth={2}
                barSize={18}
                {...ANIMATION}
              >
                {data.map((row) => (
                  <Cell key={row.key} radius={radius(row, k) as unknown as number} />
                ))}
            {selectionBar(selected, toggle, () => 100, 18)}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/* ---------- 3. Photo to ranked issue: distribution of every run, with median and p90 ---------- */

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function TriageChart({
  lang,
  copy,
  samplesMs,
  medianMs,
  p90Ms,
}: { lang: Lang; copy: ImpactChartsCopy } & ImpactChartsProps["triage"]) {
  const ANIMATION = useAnimation();
  const { selected, toggle } = useSelection();
  const bins = useMemo(() => {
    if (!samplesMs.length) return [];
    const secs = samplesMs.map((ms) => ms / 1000);
    const max = Math.max(...secs);
    const step = niceStep(Math.max(max, 1) / 8);
    const count = Math.max(1, Math.ceil((max + 1e-9) / step));
    const out = Array.from({ length: count }, (_, i) => ({ from: i * step, to: (i + 1) * step, mid: (i + 0.5) * step, count: 0 }));
    for (const s of secs) out[Math.min(count - 1, Math.floor(s / step))].count++;
    return out;
  }, [samplesMs]);

  if (!bins.length) return <EmptyPlot text={copy.noData} />;

  const maxX = bins[bins.length - 1].to;
  const sec = (v: number) => `${num(v, lang, 1)} ${copy.seconds}`;
  const n = samplesMs.length;

  return (
    <>
      <div className="viz-figures">
        {medianMs !== null ? (
          <div>
            <span className="viz-figure">{sec(medianMs / 1000)}</span>
            <span className="label-small">{copy.median}</span>
          </div>
        ) : null}
        {p90Ms !== null ? (
          <div>
            <span className="viz-figure">{sec(p90Ms / 1000)}</span>
            <span className="label-small">{copy.p90}</span>
          </div>
        ) : null}
        <div className="viz-figure-chip">
          <StatusChip status={n === 0 ? "none" : n < 10 ? "early" : "measured"} n={n} lang={lang} copy={copy} />
        </div>
      </div>
      <div className="viz-plot" role="img" aria-label={copy.triageTitle}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={bins} margin={{ top: 24, right: 16, bottom: 4, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
            <XAxis
              type="number"
              dataKey="mid"
              domain={[0, maxX]}
              ticks={bins.map((b) => b.from).concat(maxX)}
              tickFormatter={(v: number) => num(v, lang, 1)}
              tick={AXIS_TICK}
              axisLine={{ stroke: "var(--viz-axis)" }}
              tickLine={false}
              label={{ value: copy.seconds, position: "insideBottomRight", offset: -2, fill: "var(--viz-ink-2)", fontSize: 11 }}
            />
            <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} />
            <Tooltip
              cursor={{ fill: "var(--viz-cursor)" }}
              content={(p) => {
                const bin = (p.payload?.[0]?.payload ?? null) as (typeof bins)[number] | null;
                if (!p.active || !bin) return null;
                return (
                  <TooltipBox title={`${num(bin.from, lang, 1)}–${num(bin.to, lang, 1)} ${copy.seconds}`}>
                    <TooltipLine color={SERIES.primary} label={copy.reports} value={num(bin.count, lang)} />
                  </TooltipBox>
                );
              }}
            />
            <Bar
              dataKey="count"
              fill={SERIES.primary}
              onClick={(_entry: unknown, index: number) => toggle(index)}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              // The hovered bar is drawn by activeBar, so both states carry the selection ring.
              activeBar={(props: unknown) => {
                const p = props as ShapeProps & Record<string, unknown>;
                return (
                  <g>
                    <Rectangle {...p} fill="var(--viz-1-strong)" />
                    {p.index === selected ? <SelectionRing {...p} /> : null}
                  </g>
                );
              }}
              shape={(props: unknown) => {
                const p = props as ShapeProps & Record<string, unknown>;
                return (
                  <g>
                    <Rectangle {...p} />
                    {p.index === selected ? <SelectionRing {...p} /> : null}
                  </g>
                );
              }}
              {...ANIMATION}
            />
            {medianMs !== null ? (
              <ReferenceLine
                x={medianMs / 1000}
                stroke="var(--viz-ink)"
                strokeWidth={1.5}
                label={{ value: copy.median, position: "top", fill: "var(--viz-ink)", fontSize: 11 }}
              />
            ) : null}
            {p90Ms !== null && p90Ms !== medianMs ? (
              <ReferenceLine
                x={p90Ms / 1000}
                stroke="var(--viz-ink-2)"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: copy.p90, position: "top", fill: "var(--viz-ink-2)", fontSize: 11 }}
              />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/* ---------- 4. Audit coverage: logged vs missing entries per record type ---------- */

function AuditChart({ lang, copy, rows }: { lang: Lang; copy: ImpactChartsCopy; rows: AuditRow[] }) {
  const ANIMATION = useAnimation();
  const [focus, setFocus] = useState<SeriesKey | null>(null);
  const shown = rows.filter((r) => r.expected > 0).map((r) => ({ ...r, missing: r.expected - r.recorded }));
  const empty = rows.filter((r) => r.expected === 0).map((r) => r.label);
  const values = new Map(shown.map((r) => [r.label, { text: `${num(r.recorded, lang)}/${num(r.expected, lang)}`, muted: false }]));
  const maxExpected = Math.max(1, ...shown.map((r) => r.expected));
  const { ref, compact } = usePlotWidth();
  const { selected, toggle } = useSelection();
  const L = rowLayout(compact, Math.max(1, shown.length), 40);
  const opacity = (key: SeriesKey) => (focus && focus !== key ? 0.22 : 1);

  return (
    <>
      <Legend
        items={[
          { key: "primary", label: copy.legendLogged },
          { key: "failed", label: copy.legendMissing },
        ]}
        focus={focus}
        onFocus={setFocus}
      />
      {shown.length ? (
        <div className="viz-plot" role="img" aria-label={copy.auditTitle} ref={ref}>
          <ResponsiveContainer width="100%" height={L.height}>
            <BarChart data={shown} layout="vertical" margin={{ top: L.top, right: 4, bottom: 4, left: 8 }} barCategoryGap={compact ? L.gap : 12} barGap={-16}>
              <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
              <XAxis type="number" domain={[0, maxExpected]} allowDecimals={false} tick={AXIS_TICK} axisLine={{ stroke: "var(--viz-axis)" }} tickLine={false} tickFormatter={(v: number) => num(v, lang)} />
              <YAxis type="category" dataKey="label" width={L.labelWidth} axisLine={false} tickLine={false} tick={(props) => <CategoryTick {...(props as TickProps)} sub={new Map()} compact={compact} />} />
              {valueAxis(values, compact ? 52 : 64)}
              <Tooltip
                cursor={{ fill: "var(--viz-cursor)" }}
                content={(p) => {
                  const row = (p.payload?.[0]?.payload ?? null) as (typeof shown)[number] | null;
                  if (!p.active || !row) return null;
                  return (
                    <TooltipBox title={row.label}>
                      <TooltipLine color={SERIES.primary} label={copy.legendLogged} value={num(row.recorded, lang)} />
                      <TooltipLine color={SERIES.failed} label={copy.legendMissing} value={num(row.missing, lang)} />
                      <div className="viz-tooltip-foot label-small">{pctText((row.recorded / row.expected) * 100, lang)}</div>
                    </TooltipBox>
                  );
                }}
              />
              <Bar dataKey="recorded" stackId="a" fill={SERIES.primary} fillOpacity={opacity("primary")} stroke="var(--viz-surface)" strokeWidth={2} barSize={16} {...ANIMATION}>
                {shown.map((row) => (
                  <Cell key={row.label} radius={(row.missing ? [0, 0, 0, 0] : [0, 4, 4, 0]) as unknown as number} />
                ))}
              </Bar>
              <Bar dataKey="missing" stackId="a" fill={SERIES.failed} fillOpacity={opacity("failed")} stroke="var(--viz-surface)" strokeWidth={2} barSize={16} radius={[0, 4, 4, 0]} {...ANIMATION} />
              {selectionBar(selected, toggle, "expected", 16)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyPlot text={copy.noData} />
      )}
      {empty.length ? (
        <p className="label-small viz-footnote">
          {copy.notYetRecorded}: {empty.join(" · ")}
        </p>
      ) : null}
    </>
  );
}

function EmptyPlot({ text }: { text: string }) {
  return (
    <div className="viz-empty">
      <span className="tag">{text}</span>
    </div>
  );
}
