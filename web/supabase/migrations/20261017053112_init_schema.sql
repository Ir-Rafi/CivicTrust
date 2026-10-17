-- CivicTrust initial schema
-- Access model for the prototype: no end-user auth. Every table has RLS enabled
-- with no anon/authenticated policies, so the Data API is closed to the browser.
-- All reads/writes go through Next.js server code using the secret (service_role) key.

create extension if not exists postgis with schema extensions;
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Reference data (seeded from OpenStreetMap for the pilot area)
-- ---------------------------------------------------------------------------

create table public.wards (
  id bigint generated always as identity primary key,
  osm_id bigint unique,
  code text unique,
  name_en text not null,
  name_bn text,
  city text,
  boundary extensions.geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now()
);
create index wards_boundary_idx on public.wards using gist (boundary);

create table public.pois (
  id bigint generated always as identity primary key,
  osm_id text unique not null,
  kind text not null check (kind in ('school', 'hospital', 'clinic')),
  name text,
  location extensions.geography(Point, 4326) not null
);
create index pois_location_idx on public.pois using gist (location);
create index pois_kind_idx on public.pois (kind);

create table public.roads (
  id bigint generated always as identity primary key,
  osm_id text unique not null,
  name text,
  highway text not null,
  geom extensions.geography(LineString, 4326) not null
);
create index roads_geom_idx on public.roads using gist (geom);

create table public.contractors (
  id bigint generated always as identity primary key,
  name text not null,
  company text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ngos (
  id bigint generated always as identity primary key,
  name text not null,
  contact text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Core workflow
-- ---------------------------------------------------------------------------

create table public.issues (
  id bigint generated always as identity primary key,
  issue_type text not null
    check (issue_type in ('pothole', 'road_crack', 'garbage', 'open_drain', 'waterlogging', 'other')),
  visual_class text not null check (visual_class in ('minor', 'moderate', 'severe')),
  severity smallint not null check (severity between 1 and 10),
  -- every input to the score, so the UI can explain it
  severity_components jsonb not null default '{}'::jsonb,
  ai_confidence real check (ai_confidence between 0 and 1),
  ai_reason_en text,
  ai_reason_bn text,
  status text not null default 'reported'
    check (status in ('reported', 'verified', 'assigned', 'in_progress', 'fixed', 'confirmed', 'disputed', 'rejected')),
  location extensions.geography(Point, 4326) not null,
  ward_id bigint references public.wards (id) on delete set null,
  road_highway text,
  road_name text,
  report_count integer not null default 1 check (report_count >= 1),
  -- set when an officer corrects the AI: {by, from:{type,severity}, to:{...}, reason, at}
  ai_override jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fixed_at timestamptz,
  confirmed_at timestamptz
);
create index issues_location_idx on public.issues using gist (location);
create index issues_ward_id_idx on public.issues (ward_id);
create index issues_queue_idx on public.issues (status, severity desc, created_at);

create table public.reports (
  id bigint generated always as identity primary key,
  issue_id bigint not null references public.issues (id) on delete cascade,
  reporter_name text not null,
  photo_path text not null,
  location extensions.geography(Point, 4326) not null,
  captured_at timestamptz not null,
  device text,
  merged_as_duplicate boolean not null default false,
  ai_raw jsonb,
  created_at timestamptz not null default now()
);
create index reports_issue_id_idx on public.reports (issue_id);

create table public.work_orders (
  id bigint generated always as identity primary key,
  issue_id bigint not null references public.issues (id) on delete cascade,
  assignee_type text not null check (assignee_type in ('contractor', 'ngo')),
  contractor_id bigint references public.contractors (id) on delete set null,
  ngo_id bigint references public.ngos (id) on delete set null,
  deadline timestamptz not null,
  -- the rule used to set the deadline, with RAG citation: {rule, source, chunk_id}
  deadline_basis jsonb,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'submitted', 'approved', 'rejected', 'cancelled')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (assignee_type = 'contractor' and contractor_id is not null)
    or (assignee_type = 'ngo' and ngo_id is not null)
  )
);
create index work_orders_issue_id_idx on public.work_orders (issue_id);
create index work_orders_contractor_id_idx on public.work_orders (contractor_id);
create index work_orders_ngo_id_idx on public.work_orders (ngo_id);
create index work_orders_status_deadline_idx on public.work_orders (status, deadline);
-- one live work order per issue
create unique index work_orders_one_active_idx on public.work_orders (issue_id)
  where status in ('open', 'in_progress', 'submitted');

create table public.repair_proofs (
  id bigint generated always as identity primary key,
  work_order_id bigint not null references public.work_orders (id) on delete cascade,
  photo_path text not null,
  location extensions.geography(Point, 4326) not null,
  captured_at timestamptz not null,
  distance_m real not null,
  verdict text not null check (verdict in ('approved', 'rejected', 'needs_review')),
  verdict_reason_en text,
  verdict_reason_bn text,
  checks jsonb not null default '{}'::jsonb,
  ai_raw jsonb,
  created_at timestamptz not null default now()
);
create index repair_proofs_work_order_id_idx on public.repair_proofs (work_order_id);

create table public.citizen_feedback (
  id bigint generated always as identity primary key,
  issue_id bigint not null references public.issues (id) on delete cascade,
  citizen_name text not null,
  verdict text not null check (verdict in ('confirmed', 'disputed')),
  rating smallint check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index citizen_feedback_issue_id_idx on public.citizen_feedback (issue_id);

-- ---------------------------------------------------------------------------
-- Knowledge layer (RAG over civic rules / SLA policy)
-- ---------------------------------------------------------------------------

create table public.policy_chunks (
  id bigint generated always as identity primary key,
  source text not null,
  title text not null,
  content text not null,
  embedding extensions.vector(768),
  created_at timestamptz not null default now()
);
create index policy_chunks_embedding_idx on public.policy_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Tamper-evident audit log (append-only, hash-chained)
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_role text not null
    check (actor_role in ('citizen', 'officer', 'contractor', 'ngo', 'public', 'system', 'ai')),
  actor_name text not null,
  action text not null,
  entity text not null,
  entity_id bigint,
  payload jsonb not null default '{}'::jsonb,
  prev_hash text,
  hash text not null
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- One definition of the row hash, used by both the insert trigger and the verifier.
-- Timestamps are rendered in UTC so the hash does not depend on the session time zone.
create function public.audit_row_hash(
  prev_hash text, created_at timestamptz, actor_role text, actor_name text,
  action text, entity text, entity_id bigint, payload jsonb
)
returns text
language sql
stable
set search_path = ''
as $$
  select encode(sha256(convert_to(
    coalesce(prev_hash, '') || '|'
      || to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '|'
      || actor_role || '|' || actor_name || '|' || action || '|' || entity || '|'
      || coalesce(entity_id::text, '') || '|' || payload::text,
    'UTF8'
  )), 'hex');
$$;

create function public.audit_log_chain()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- serialize writers so the chain never forks
  perform pg_advisory_xact_lock(hashtext('public.audit_log'));
  select a.hash into new.prev_hash
  from public.audit_log a
  order by a.id desc
  limit 1;
  new.created_at := now();
  new.hash := public.audit_row_hash(
    new.prev_hash, new.created_at, new.actor_role, new.actor_name,
    new.action, new.entity, new.entity_id, new.payload
  );
  return new;
end;
$$;

create trigger audit_log_chain_trg
  before insert on public.audit_log
  for each row execute function public.audit_log_chain();

create function public.audit_log_block_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_block_changes();

-- Recompute the chain and report the first broken link (null = intact).
create function public.verify_audit_chain()
returns table (total bigint, first_broken_id bigint)
language sql
stable
set search_path = ''
as $$
  with checked as (
    select
      a.id,
      coalesce(a.prev_hash, '') = coalesce(lag(a.hash) over (order by a.id), '')
      and a.hash = public.audit_row_hash(
        a.prev_hash, a.created_at, a.actor_role, a.actor_name,
        a.action, a.entity, a.entity_id, a.payload
      ) as ok
    from public.audit_log a
  )
  select (select count(*) from checked), (select min(id) from checked where not ok);
$$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger issues_updated_at before update on public.issues
  for each row execute function public.set_updated_at();
create trigger work_orders_updated_at before update on public.work_orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Geo + RAG helper functions (called from the server via RPC)
-- ---------------------------------------------------------------------------

-- Facts the severity model needs for a point: ward, nearest road class, distance to schools/hospitals.
create function public.location_context(lat double precision, lng double precision)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  with p as (
    select st_setsrid(st_makepoint(lng, lat), 4326) as g
  )
  select jsonb_build_object(
    'ward', (
      select jsonb_build_object('id', w.id, 'name_en', w.name_en, 'name_bn', w.name_bn)
      from wards w, p
      where st_covers(w.boundary, p.g)
      limit 1
    ),
    'road', (
      select jsonb_build_object(
        'highway', r.highway,
        'name', r.name,
        'distance_m', round(st_distance(r.geom, p.g::geography)::numeric, 1)
      )
      from roads r, p
      where st_dwithin(r.geom, p.g::geography, 40)
      order by r.geom <-> p.g::geography
      limit 1
    ),
    'nearest_school', (
      select jsonb_build_object('name', s.name, 'distance_m', round(st_distance(s.location, p.g::geography)::numeric, 1))
      from pois s, p
      where s.kind = 'school' and st_dwithin(s.location, p.g::geography, 1000)
      order by s.location <-> p.g::geography
      limit 1
    ),
    'nearest_hospital', (
      select jsonb_build_object('name', h.name, 'distance_m', round(st_distance(h.location, p.g::geography)::numeric, 1))
      from pois h, p
      where h.kind in ('hospital', 'clinic') and st_dwithin(h.location, p.g::geography, 1000)
      order by h.location <-> p.g::geography
      limit 1
    )
  );
$$;

-- Open issues within radius_m of a point: candidates for duplicate merging.
create function public.nearby_open_issues(lat double precision, lng double precision, radius_m double precision default 25)
returns table (id bigint, issue_type text, severity smallint, status text, distance_m double precision)
language sql
stable
set search_path = public, extensions
as $$
  select
    i.id,
    i.issue_type,
    i.severity,
    i.status,
    st_distance(i.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_m
  from issues i
  where i.status not in ('fixed', 'confirmed', 'rejected')
    and st_dwithin(i.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_m)
  order by distance_m;
$$;

-- Semantic search over civic rules.
create function public.match_policy_chunks(query_embedding extensions.vector(768), match_count integer default 4)
returns table (id bigint, source text, title text, content text, similarity double precision)
language sql
stable
set search_path = public, extensions
as $$
  select c.id, c.source, c.title, c.content, 1 - (c.embedding <=> query_embedding) as similarity
  from policy_chunks c
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Public transparency numbers per ward.
create function public.ward_stats()
returns table (
  ward_id bigint,
  ward_name_en text,
  ward_name_bn text,
  open_count bigint,
  fixed_count bigint,
  avg_fix_hours double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select
    w.id,
    w.name_en,
    w.name_bn,
    count(i.id) filter (where i.status not in ('fixed', 'confirmed', 'rejected')),
    count(i.id) filter (where i.status in ('fixed', 'confirmed')),
    avg(extract(epoch from (i.fixed_at - i.created_at)) / 3600.0) filter (where i.fixed_at is not null)
  from wards w
  left join issues i on i.ward_id = w.id
  group by w.id, w.name_en, w.name_bn
  order by w.name_en;
$$;

-- ---------------------------------------------------------------------------
-- Security: RLS on everything, browser roles get nothing, server role gets what it needs
-- ---------------------------------------------------------------------------

alter table public.wards enable row level security;
alter table public.pois enable row level security;
alter table public.roads enable row level security;
alter table public.contractors enable row level security;
alter table public.ngos enable row level security;
alter table public.issues enable row level security;
alter table public.reports enable row level security;
alter table public.work_orders enable row level security;
alter table public.repair_proofs enable row level security;
alter table public.citizen_feedback enable row level security;
alter table public.policy_chunks enable row level security;
alter table public.audit_log enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant select, insert, update, delete on
  public.wards, public.pois, public.roads, public.contractors, public.ngos,
  public.issues, public.reports, public.work_orders, public.repair_proofs,
  public.citizen_feedback, public.policy_chunks
  to service_role;
-- audit log: insert + read only
grant select, insert on public.audit_log to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function
  public.location_context(double precision, double precision),
  public.nearby_open_issues(double precision, double precision, double precision),
  public.match_policy_chunks(extensions.vector, integer),
  public.ward_stats(),
  public.verify_audit_chain(),
  public.audit_row_hash(text, timestamptz, text, text, text, text, bigint, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for report + repair photos (served via signed URLs)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
