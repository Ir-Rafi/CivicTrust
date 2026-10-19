-- Per-area figures without official ward boundaries (FR-06 area filter, FR-10 area-level
-- outcomes), and NGO offers of help (user requirement: "NGO/Volunteer: indicate willingness
-- to assist").

-- OpenStreetMap area (suburb level, e.g. "Lalmatia") of each issue, looked up when it is
-- reported. Not an official ward: the UI says the areas come from OpenStreetMap.
alter table public.issues
  add column if not exists area_en text,
  add column if not exists area_bn text;
create index if not exists issues_area_en_idx on public.issues (area_en);

-- Same figures as ward_stats(), grouped by area; used while the wards table is empty.
create or replace function public.area_stats()
returns table (area_en text, area_bn text, open_count bigint, fixed_count bigint, avg_fix_hours double precision)
language sql
stable
set search_path = public
as $$
  select
    i.area_en,
    max(i.area_bn),
    count(*) filter (where i.status not in ('fixed', 'confirmed', 'rejected')),
    count(*) filter (where i.status in ('fixed', 'confirmed')),
    avg(extract(epoch from (i.fixed_at - i.created_at)) / 3600.0) filter (where i.fixed_at is not null)
  from public.issues i
  where i.status <> 'rejected'
  group by i.area_en
  order by i.area_en nulls last;
$$;

-- An NGO or volunteer group offering to fix an open issue. The ward officer decides by assigning.
create table if not exists public.ngo_offers (
  id bigint generated always as identity primary key,
  issue_id bigint not null references public.issues (id) on delete cascade,
  ngo_id bigint not null references public.ngos (id) on delete cascade,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (issue_id, ngo_id)
);
create index if not exists ngo_offers_issue_id_idx on public.ngo_offers (issue_id);

-- Same model as every other table: RLS on, browsers get nothing, the server role does the work.
alter table public.ngo_offers enable row level security;
revoke all on public.ngo_offers from anon, authenticated;
grant select, insert, delete on public.ngo_offers to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke execute on function public.area_stats() from public, anon, authenticated;
grant execute on function public.area_stats() to service_role;
