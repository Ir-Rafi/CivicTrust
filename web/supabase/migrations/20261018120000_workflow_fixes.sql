-- Fixes to the preliminary workflow: officer review of repair proofs, a payment gate that
-- respects disputes and officer decisions, an on-time rate that counts overdue jobs,
-- map coordinates for officer screens, and closing the new functions to browser roles.

-- Officer decision on a repair proof: resolves needs_review, or re-checks a disputed approval.
-- The AI verdict stays as recorded; the effective decision is coalesce(officer_decision, verdict).
alter table public.repair_proofs
  add column if not exists officer_decision text check (officer_decision in ('approved', 'rejected')),
  add column if not exists officer_reason text,
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz;

-- Plain coordinates for the officer map. Officer/crew screens only; public views stay at ward level.
alter table public.issues
  add column if not exists lat double precision
    generated always as (extensions.st_y(location::extensions.geometry)) stored,
  add column if not exists lng double precision
    generated always as (extensions.st_x(location::extensions.geometry)) stored;

-- Release needs: the work order approved, its latest repair proof effectively approved, and
-- the issue not disputed or reopened by a citizen.
create or replace function public.enforce_payment_gate()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  latest_decision text;
  current_issue_status text;
begin
  if new.payment_status = 'released' and (tg_op = 'INSERT' or old.payment_status is distinct from 'released') then
    select coalesce(p.officer_decision, p.verdict) into latest_decision
    from public.repair_proofs p
    where p.work_order_id = new.id
    order by p.created_at desc, p.id desc
    limit 1;
    if latest_decision is distinct from 'approved' or new.status <> 'approved' then
      raise exception 'payment cannot be released before an approved repair proof';
    end if;
    select i.status into current_issue_status from public.issues i where i.id = new.issue_id;
    if current_issue_status not in ('fixed', 'confirmed') then
      raise exception 'payment cannot be released while the repair is disputed or reopened';
    end if;
  end if;
  if new.payment_status = 'released' and new.payment_released_at is null then
    new.payment_released_at := now();
  end if;
  return new;
end;
$$;

-- On time = the approved proof was submitted by the deadline (officer review time is not the
-- contractor's delay). Overdue unfinished jobs count against the rate, per the policy.
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
  with completion as (
    select p.work_order_id, min(p.created_at) as completed_at
    from public.repair_proofs p
    where coalesce(p.officer_decision, p.verdict) = 'approved'
    group by p.work_order_id
  ), order_stats as (
    select
      c.id,
      c.name,
      c.company,
      count(w.id) filter (where w.status <> 'cancelled') as assigned_count,
      count(w.id) filter (where w.status = 'approved') as approved_count,
      count(w.id) filter (where w.status = 'rejected') as rejected_count,
      count(w.id) filter (where w.status = 'approved' and k.completed_at <= w.deadline) as on_time_count,
      count(w.id) filter (
        where w.status = 'approved'
          or (w.status in ('open', 'in_progress', 'submitted', 'rejected') and w.deadline < now())
      ) as due_count
    from public.contractors c
    left join public.work_orders w on w.contractor_id = c.id
    left join completion k on k.work_order_id = w.id
    group by c.id, c.name, c.company
  ), disputes as (
    select w.contractor_id, count(distinct f.id) as disputed_count
    from public.work_orders w
    join public.citizen_feedback f
      on f.issue_id = w.issue_id and f.verdict = 'disputed' and f.created_at >= w.created_at
    where w.contractor_id is not null and w.status <> 'cancelled'
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
    case when s.due_count = 0 then null
      else round((s.on_time_count::numeric / s.due_count::numeric) * 100, 1)
    end
  from order_stats s
  left join disputes d on d.contractor_id = s.id
  order by s.name;
$$;

-- Supabase grants EXECUTE on new public functions to browser roles by default; the first
-- migration revoked them, this closes the ones added since and any added later.
revoke execute on function
  public.repair_distance_to_issue(bigint, double precision, double precision),
  public.contractor_scorecards(),
  public.enforce_payment_gate()
  from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function
  public.repair_distance_to_issue(bigint, double precision, double precision),
  public.contractor_scorecards()
  to service_role;
