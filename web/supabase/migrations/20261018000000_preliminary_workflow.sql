-- Preliminary workflow additions: officer assignment, repair verification,
-- payment gating, and contractor scorecards.

alter table public.work_orders
  add column if not exists agreed_cost numeric(12, 2),
  add column if not exists payment_status text not null default 'withheld',
  add column if not exists payment_released_at timestamptz;

alter table public.work_orders
  drop constraint if exists work_orders_agreed_cost_check;
alter table public.work_orders
  add constraint work_orders_agreed_cost_check check (agreed_cost is null or agreed_cost >= 0);

alter table public.work_orders
  drop constraint if exists work_orders_payment_status_check;
alter table public.work_orders
  add constraint work_orders_payment_status_check
  check (payment_status in ('withheld', 'eligible', 'released'));

create index if not exists work_orders_payment_status_idx on public.work_orders (payment_status);

-- A work order can be marked released only after an approved proof exists.
create or replace function public.enforce_payment_gate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payment_status = 'released' and not exists (
    select 1 from public.repair_proofs p
    where p.work_order_id = new.id and p.verdict = 'approved'
  ) then
    raise exception 'payment cannot be released before an approved repair proof';
  end if;
  if new.payment_status = 'released' and new.payment_released_at is null then
    new.payment_released_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists work_order_payment_gate on public.work_orders;
create trigger work_order_payment_gate
  before insert or update of payment_status, payment_released_at on public.work_orders
  for each row execute function public.enforce_payment_gate();

-- Distance from a submitted repair photo to the original issue location.
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
    st_setsrid(st_makepoint(lng, lat), 4326)::geography
  )
  from public.issues i
  where i.id = target_issue_id;
$$;

-- Contractor outcomes used by the public scorecard and officer queue.
create or replace function public.contractor_scorecards()
returns table (
  contractor_id bigint,
  contractor_name text,
  company text,
  assigned_count bigint,
  approved_count bigint,
  rejected_count bigint,
  disputed_count bigint,
  on_time_count bigint,
  on_time_rate numeric
)
language sql
stable
set search_path = public
as $$
  with order_stats as (
    select
      c.id,
      c.name,
      c.company,
      count(w.id) as assigned_count,
      count(w.id) filter (where w.status = 'approved') as approved_count,
      count(w.id) filter (where w.status = 'rejected') as rejected_count,
      count(w.id) filter (
        where w.status = 'approved'
          and w.updated_at <= w.deadline
      ) as on_time_count
    from public.contractors c
    left join public.work_orders w on w.contractor_id = c.id
    group by c.id, c.name, c.company
  ), disputes as (
    select w.contractor_id, count(distinct f.id) as disputed_count
    from public.work_orders w
    left join public.citizen_feedback f
      on f.issue_id = w.issue_id and f.verdict = 'disputed'
    where w.contractor_id is not null
    group by w.contractor_id
  )
  select
    s.id,
    s.name,
    s.company,
    s.assigned_count,
    s.approved_count,
    s.rejected_count,
    coalesce(d.disputed_count, 0),
    s.on_time_count,
    case when s.assigned_count = 0 then 0
      else round((s.on_time_count::numeric / s.assigned_count::numeric) * 100, 1)
    end
  from order_stats s
  left join disputes d on d.contractor_id = s.id
  order by s.name;
$$;

grant execute on function public.repair_distance_to_issue(bigint, double precision, double precision) to service_role;
grant execute on function public.contractor_scorecards() to service_role;
