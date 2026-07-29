-- 투고자가 게재확정 전 원고를 철회하되 기록은 삭제하지 않고 보존한다.

alter table public.manuscripts
  add column withdrawal_reason text,
  add column withdrawn_at timestamptz,
  add column withdrawn_by uuid references public.profiles(id) on delete set null,
  add constraint manuscript_withdrawal_metadata check (
    (status = 'WITHDRAWN' and withdrawn_at is not null and withdrawal_reason is not null)
    or (status <> 'WITHDRAWN' and withdrawn_at is null and withdrawal_reason is null and withdrawn_by is null)
  );

create or replace function public.prevent_withdrawn_manuscript_reactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'WITHDRAWN' and new.status is distinct from old.status then
    raise exception 'Withdrawn manuscripts cannot be reactivated';
  end if;
  return new;
end;
$$;

create trigger manuscripts_prevent_withdrawn_reactivation
before update of status on public.manuscripts
for each row execute function public.prevent_withdrawn_manuscript_reactivation();

create or replace function public.withdraw_manuscript(
  target_manuscript_id uuid,
  reason text
)
returns public.manuscripts
language plpgsql
security definer
set search_path = ''
as $$
declare
  manuscript_row public.manuscripts;
  normalized_reason text;
begin
  if not public.has_app_role('AUTHOR') then raise exception 'Author permission required'; end if;
  normalized_reason := trim(coalesce(reason, ''));
  if length(normalized_reason) < 5 then raise exception 'A withdrawal reason of at least 5 characters is required'; end if;

  select * into manuscript_row
  from public.manuscripts
  where id = target_manuscript_id and created_by = auth.uid()
  for update;

  if manuscript_row.id is null then raise exception 'Manuscript not found'; end if;
  if manuscript_row.status not in (
    'SUBMITTED', 'RECEIVED', 'FORMAT_REVIEW', 'REVIEWER_SELECTION', 'UNDER_REVIEW',
    'REVISION_REQUESTED', 'REVISION_SUBMITTED', 'RE_REVIEW', 'ACCEPTED', 'ACCEPT_WITH_REVISIONS'
  ) then raise exception 'Withdrawal is not allowed in the current status'; end if;

  update public.reviewer_assignments
  set status = 'CANCELLED'
  where manuscript_id = target_manuscript_id
    and status in ('INVITED', 'ACCEPTED');

  update public.manuscripts
  set status = 'WITHDRAWN',
      current_due_at = null,
      withdrawal_reason = normalized_reason,
      withdrawn_at = now(),
      withdrawn_by = auth.uid()
  where id = target_manuscript_id
  returning * into manuscript_row;

  update public.manuscript_status_history
  set note = '투고자 철회: ' || normalized_reason
  where id = (
    select h.id from public.manuscript_status_history h
    where h.manuscript_id = target_manuscript_id and h.to_status = 'WITHDRAWN'
    order by h.id desc limit 1
  );

  return manuscript_row;
end;
$$;

revoke execute on function public.prevent_withdrawn_manuscript_reactivation() from public, anon, authenticated;
revoke execute on function public.withdraw_manuscript(uuid, text) from public, anon;
grant execute on function public.withdraw_manuscript(uuid, text) to authenticated;

comment on function public.withdraw_manuscript(uuid, text) is
  '논문 소유 투고자가 게재확정 전 원고를 철회하고 심사 배정을 취소하며 사유와 상태이력을 보존';
