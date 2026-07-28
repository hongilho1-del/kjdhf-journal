-- CASE 표현식의 enum 형식을 명시해 런타임 상태전환 오류를 방지한다.

create or replace function public.assign_reviewer(
  target_manuscript_id uuid,
  target_reviewer_id uuid,
  review_due_at timestamptz
)
returns public.reviewer_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  manuscript_row public.manuscripts;
  assignment_row public.reviewer_assignments;
  active_count integer;
begin
  if not public.is_editorial() then raise exception 'Editorial permission required'; end if;
  if review_due_at <= now() then raise exception 'Review due date must be in the future'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = target_reviewer_id and p.role = 'REVIEWER' and p.is_active
  ) then raise exception 'Active reviewer not found'; end if;

  select * into manuscript_row from public.manuscripts where id = target_manuscript_id for update;
  if manuscript_row.id is null then raise exception 'Manuscript not found'; end if;
  if manuscript_row.status not in ('FORMAT_REVIEW', 'REVIEWER_SELECTION', 'REVISION_SUBMITTED', 'RE_REVIEW') then
    raise exception 'Reviewer assignment is not allowed in the current status';
  end if;

  select count(*) into active_count
  from public.reviewer_assignments ra
  where ra.manuscript_id = target_manuscript_id
    and ra.round_no = greatest(manuscript_row.round_no, 1)
    and ra.status not in ('DECLINED', 'CANCELLED');
  if active_count >= 2 then raise exception 'Two active reviewers are already assigned for this round'; end if;

  insert into public.reviewer_assignments (manuscript_id, reviewer_id, assigned_by, round_no, due_at)
  values (target_manuscript_id, target_reviewer_id, auth.uid(), greatest(manuscript_row.round_no, 1), review_due_at)
  returning * into assignment_row;

  update public.manuscripts
  set status = case
        when manuscript_row.round_no > 1 then 'RE_REVIEW'::public.manuscript_status
        else 'REVIEWER_SELECTION'::public.manuscript_status
      end,
      current_due_at = greatest(coalesce(current_due_at, review_due_at), review_due_at)
  where id = target_manuscript_id;

  return assignment_row;
end;
$$;

create or replace function public.respond_to_review_assignment(
  target_assignment_id uuid,
  accept_assignment boolean,
  response_reason text default null
)
returns public.reviewer_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.reviewer_assignments;
  accepted_count integer;
  target_round integer;
begin
  select * into assignment_row
  from public.reviewer_assignments
  where id = target_assignment_id and reviewer_id = auth.uid()
  for update;
  if assignment_row.id is null then raise exception 'Assignment not found'; end if;
  if assignment_row.status <> 'INVITED' then raise exception 'Assignment has already been answered'; end if;

  update public.reviewer_assignments
  set status = case
        when accept_assignment then 'ACCEPTED'::public.assignment_status
        else 'DECLINED'::public.assignment_status
      end,
      responded_at = now(),
      decline_reason = case when accept_assignment then null else nullif(trim(coalesce(response_reason, '')), '') end
  where id = target_assignment_id
  returning * into assignment_row;

  if accept_assignment then
    select count(*) into accepted_count
    from public.reviewer_assignments ra
    where ra.manuscript_id = assignment_row.manuscript_id
      and ra.round_no = assignment_row.round_no
      and ra.status in ('ACCEPTED', 'COMPLETED');
    select round_no into target_round from public.manuscripts where id = assignment_row.manuscript_id;
    if accepted_count >= 2 then
      update public.manuscripts
      set status = case
        when target_round > 1 then 'RE_REVIEW'::public.manuscript_status
        else 'UNDER_REVIEW'::public.manuscript_status
      end
      where id = assignment_row.manuscript_id;
    end if;
  end if;
  return assignment_row;
end;
$$;
