-- Reassigning an issue after a rejected repair cancels the old work order. The scorecard ignored
-- cancelled orders and matched disputes by issue, so a contractor whose repair was disputed and
-- rejected ended up with a clean record. Disputes now point at the work order they were about,
-- and a cancelled order still counts as assigned and, if its last repair was rejected, as rejected.

alter table public.citizen_feedback
  add column if not exists work_order_id bigint references public.work_orders (id) on delete set null;
create index if not exists citizen_feedback_work_order_id_idx on public.citizen_feedback (work_order_id);

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
  with latest_proof as (
    select distinct on (p.work_order_id)
      p.work_order_id, coalesce(p.officer_decision, p.verdict) as decision
    from public.repair_proofs p
    order by p.work_order_id, p.created_at desc, p.id desc
  ), completion as (
    select p.work_order_id, min(p.created_at) as completed_at
    from public.repair_proofs p
    where coalesce(p.officer_decision, p.verdict) = 'approved'
    group by p.work_order_id
  ), order_stats as (
    select
      c.id,
      c.name,
      c.company,
      count(w.id) as assigned_count,
      count(w.id) filter (where w.status = 'approved') as approved_count,
      count(w.id) filter (where w.status <> 'approved' and lp.decision = 'rejected') as rejected_count,
      count(w.id) filter (where w.status = 'approved' and k.completed_at <= w.deadline) as on_time_count,
      count(w.id) filter (where w.status = 'approved' or w.deadline < now()) as due_count
    from public.contractors c
    left join public.work_orders w on w.contractor_id = c.id
    left join latest_proof lp on lp.work_order_id = w.id
    left join completion k on k.work_order_id = w.id
    group by c.id, c.name, c.company
  ), disputes as (
    select w.contractor_id, count(f.id) as disputed_count
    from public.citizen_feedback f
    join public.work_orders w on w.id = f.work_order_id
    where f.verdict = 'disputed' and w.contractor_id is not null
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
