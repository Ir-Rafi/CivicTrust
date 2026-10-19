"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, type MouseEvent, type ReactNode } from "react";
import { SeverityScore } from "@/components/issues/severity-breakdown";
import { IssueMapLazy } from "@/components/officer/issue-map-lazy";
import { ISSUE_TYPES } from "@/lib/ai/schemas";
import type { OrderFlag } from "@/lib/dashboard";
import { statusTone } from "@/lib/format";
import { num, type Dict, type Lang } from "@/lib/i18n";
import { applyQueueFilters, FILTERS, officerQueueHref, readQueueSelection, type Filter } from "@/lib/officer-queue";
import type { OfficerQueueItem } from "@/lib/workflow";

/** Filter the loaded queue without a server navigation; modified clicks still open a deep link. */
function FilterLink({ href, children, ...props }: {
  href: string;
  children: ReactNode;
  className: string;
  "aria-current"?: "true";
}) {
  function select(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (href !== window.location.pathname + window.location.search) window.history.pushState(null, "", href);
  }
  return <a href={href} onClick={select} {...props}>{children}</a>;
}

export function OfficerQueue({ all, flagEntries, panelIssueId, lang, t, children }: {
  all: OfficerQueueItem[];
  flagEntries: [number, OrderFlag][];
  panelIssueId: number | null;
  lang: Lang;
  t: Pick<Dict, "officer" | "issueType" | "visualClass" | "common" | "status">;
  children: ReactNode;
}) {
  const params = useSearchParams();
  const selection = useMemo(() => readQueueSelection(params), [params]);
  const { filter, type, area, selectedId } = selection;
  const flags = useMemo(() => new Map(flagEntries), [flagEntries]);
  // Keep area choices stable while type and status filters change.
  const areas = useMemo(() => [...new Map(all.filter((i) => i.area_en).map((i) => [i.area_en!, i.area_bn ?? i.area_en!])).entries()]
    .sort((a, b) => a[0].localeCompare(b[0])), [all]);
  const items = useMemo(() => applyQueueFilters(all, selection, flags), [all, selection, flags]);
  const points = useMemo(() => items.map((i) => ({ id: i.id, lat: i.lat, lng: i.lng, severity: i.severity,
    label: `#CT-${i.id} · ${t.issueType[i.issue_type]}` })), [items, t.issueType]);
  const href = (next: Parameters<typeof officerQueueHref>[1]) => officerQueueHref({ filter, type, area, selectedId }, next);
  const filterLabel: Record<Filter, string> = {
    open: t.officer.filterOpen,
    new: t.officer.filterNew,
    critical: t.officer.filterCritical,
    action: t.officer.filterAction,
    all: t.officer.filterAll,
  };

  return (
    <div className="asymmetric-grid">
      <div className="stack" style={{ gap: 24 }}>
        <section className="card">
          <div className="card-head" style={{ flexWrap: "wrap" }}>
            <div>
              <h1 className="headline-small">{t.officer.title}</h1>
              <p className="label-small" style={{ maxWidth: 520 }}>
                {t.officer.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: 16 }}>
            <nav className="filter-group" aria-label={t.officer.colStatus}>
              {FILTERS.map((f) => (
                <FilterLink key={f} href={href({ f, issue: null })} className="filter-link" aria-current={f === filter ? "true" : undefined}>
                  {filterLabel[f]}
                </FilterLink>
              ))}
            </nav>
            <nav className="filter-group" aria-label={t.officer.filterType}>
              <FilterLink href={href({ type: null, issue: null })} className="filter-link" aria-current={!type ? "true" : undefined}>
                {t.officer.anyType}
              </FilterLink>
              {ISSUE_TYPES.filter((v) => v !== "other").map((v) => (
                <FilterLink key={v} href={href({ type: v, issue: null })} className="filter-link" aria-current={v === type ? "true" : undefined}>
                  {t.issueType[v]}
                </FilterLink>
              ))}
            </nav>
            {areas.length > 0 && (
              <nav className="filter-group" aria-label={t.officer.areaFilter}>
                <FilterLink href={href({ area: null, issue: null })} className="filter-link" aria-current={!area ? "true" : undefined}>
                  {t.officer.anyArea}
                </FilterLink>
                {areas.map(([en, bn]) => (
                  <FilterLink key={en} href={href({ area: en, issue: null })} className="filter-link" aria-current={en === area ? "true" : undefined}>
                    {lang === "bn" ? bn : en}
                  </FilterLink>
                ))}
              </nav>
            )}
          </div>

          {items.length === 0 ? (
            <p className="body-medium">{t.officer.empty}</p>
          ) : (
            <div className="table-wrap">
              <table className="md-table">
                <thead>
                  <tr>
                    <th>{t.officer.colTicket}</th>
                    <th>{t.officer.colDefect}</th>
                    <th>{t.officer.colSeverity}</th>
                    <th>{t.officer.colStatus}</th>
                    <th className="num">{t.officer.colReports}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const flag = flags.get(i.id);
                    return (
                      <tr key={i.id} className={i.id === selectedId ? "is-selected" : undefined}>
                        <td>
                          <Link href={href({ issue: i.id })} scroll={false} className="row-link">
                            <strong>#CT-{i.id}</strong>
                          </Link>
                        </td>
                        <td>
                          <Link href={href({ issue: i.id })} scroll={false} className="row-link">
                            <strong style={{ fontWeight: 500 }}>
                              {t.issueType[i.issue_type]} · {t.visualClass[i.visual_class]}
                            </strong>
                            <span className="label-small" style={{ display: "block" }}>
                              {[i.road_name ?? t.common.noRoad, lang === "bn" ? (i.area_bn ?? i.area_en) : i.area_en].filter(Boolean).join(" · ")}
                            </span>
                          </Link>
                        </td>
                        <td>
                          <SeverityScore score={i.severity} lang={lang} />
                        </td>
                        <td>
                          <span className={`tag ${statusTone(i.status)}`}>{t.status[i.status as keyof typeof t.status] ?? i.status}</span>
                          {flag && (
                            <span className="tag warning" style={{ display: "flex", marginTop: 4 }}>
                              {flag === "review" ? t.officer.flagReview : t.officer.flagPayable}
                            </span>
                          )}
                        </td>
                        <td className="num">{num(i.report_count, lang)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card card-low">
          <div className="card-head">
            <h2 className="title-medium">{t.officer.mapTitle}</h2>
          </div>
          <div className="map-frame">
            <IssueMapLazy
              points={points}
              selectedId={selectedId}
            />
          </div>
          <p className="label-small" style={{ marginTop: 10 }}>
            {t.officer.mapNote}
          </p>
        </section>
      </div>

      <aside className="card card-high">
        {selectedId && selectedId === panelIssueId ? children : <p className="body-medium">{t.officer.selectHint}</p>}
      </aside>
    </div>
  );
}
