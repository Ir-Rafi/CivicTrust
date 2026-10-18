-- The generated issues.lat/lng columns added in 20261018120000 shadowed the lat/lng parameters
-- of nearby_open_issues() and repair_distance_to_issue(): inside those SQL functions an
-- unqualified "lat" resolved to the issue's own column, so every issue measured 0 m away
-- (duplicates merged across the whole map, every repair passed the 15 m check).
-- Rename the columns to names no function parameter uses, and qualify the parameters so a
-- future column cannot capture them again.

alter table public.issues rename column lat to location_lat;
alter table public.issues rename column lng to location_lng;

create or replace function public.nearby_open_issues(lat double precision, lng double precision, radius_m double precision default 25)
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
    st_distance(i.location, st_setsrid(st_makepoint(nearby_open_issues.lng, nearby_open_issues.lat), 4326)::geography) as distance_m
  from issues i
  where i.status not in ('fixed', 'confirmed', 'rejected')
    and st_dwithin(
      i.location,
      st_setsrid(st_makepoint(nearby_open_issues.lng, nearby_open_issues.lat), 4326)::geography,
      nearby_open_issues.radius_m
    )
  order by distance_m;
$$;

create or replace function public.repair_distance_to_issue(
  target_issue_id bigint, lat double precision, lng double precision
)
returns double precision
language sql
stable
set search_path = public, extensions
as $$
  select st_distance(
    i.location,
    st_setsrid(st_makepoint(repair_distance_to_issue.lng, repair_distance_to_issue.lat), 4326)::geography
  )
  from public.issues i
  where i.id = repair_distance_to_issue.target_issue_id;
$$;
