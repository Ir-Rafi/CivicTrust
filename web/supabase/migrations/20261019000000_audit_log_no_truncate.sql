-- The audit log must be append-only (FR-11). Row triggers already block UPDATE and DELETE, but
-- Supabase's default privileges had also granted service_role UPDATE, DELETE and TRUNCATE, and
-- TRUNCATE skips row triggers: one statement could empty the log, and verify_audit_chain()
-- would then report the empty chain as intact. Take the privileges away and block TRUNCATE too.

revoke update, delete, truncate on public.audit_log from service_role, anon, authenticated;

create or replace function public.audit_log_block_truncate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

drop trigger if exists audit_log_no_truncate on public.audit_log;
create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_block_truncate();

revoke execute on function public.audit_log_block_truncate() from public, anon, authenticated;
