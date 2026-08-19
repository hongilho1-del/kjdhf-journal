-- 편집진이 익명화 원고를 등록한 뒤 심사위원을 배정하고,
-- 잘못된 배정은 삭제하지 않고 취소 이력으로 보존한다.

alter table public.reviewer_assignments
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete restrict,
  add column if not exists cancellation_reason text;

drop policy if exists files_insert_author_reviewer_or_editor on public.manuscript_files;
create policy files_insert_author_reviewer_or_editor on public.manuscript_files
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    (
      public.is_editorial()
      and (
        (file_kind = 'ANONYMIZED' and bucket_id = 'manuscripts' and is_anonymized)
        or (file_kind <> 'ANONYMIZED' and (file_kind <> 'PUBLISHED' or public.is_admin()))
      )
    )
    or exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_id
        and m.created_by = auth.uid()
        and (
          (file_kind = 'ORIGINAL' and bucket_id = 'manuscripts' and not is_anonymized and m.status = 'DRAFT')
          or (file_kind = 'REVISION' and bucket_id = 'revisions' and not is_anonymized and m.status = 'REVISION_REQUESTED')
          or (file_kind = 'FINAL' and bucket_id = 'final-files' and not is_anonymized and m.status in ('ACCEPTED', 'ACCEPT_WITH_REVISIONS'))
        )
    )
    or (
      public.has_app_role('REVIEWER')
      and file_kind = 'REVIEW_ATTACHMENT'
      and bucket_id = 'review-files'
      and exists (
        select 1 from public.reviewer_assignments ra
        where ra.manuscript_id = manuscript_id
          and ra.reviewer_id = auth.uid()
          and ra.status = 'ACCEPTED'
      )
    )
  )
);

drop policy if exists reviews_select_reviewer_or_editorial on public.reviews;
create policy reviews_select_reviewer_or_editorial on public.reviews
for select to authenticated
using (
  public.is_editorial()
  or (
    public.has_app_role('REVIEWER')
    and exists (
      select 1 from public.reviewer_assignments ra
      where ra.id = assignment_id
        and ra.reviewer_id = auth.uid()
        and ra.status in ('INVITED', 'ACCEPTED', 'COMPLETED')
    )
  )
);

create or replace function public.submit_manuscript(target_manuscript_id uuid)
returns public.manuscripts
language plpgsql
security definer
set search_path = ''
as $$
declare
  manuscript_row public.manuscripts;
  submission_year integer;
  sequence_number integer;
  generated_code text;
begin
  select * into manuscript_row
  from public.manuscripts
  where id = target_manuscript_id
  for update;

  if manuscript_row.id is null or manuscript_row.created_by <> auth.uid() then
    raise exception 'Manuscript not found';
  end if;
  if manuscript_row.status <> 'DRAFT' then raise exception 'Only drafts can be submitted'; end if;
  if not (manuscript_row.ethics_confirmed and manuscript_row.conflict_of_interest_confirmed and manuscript_row.copyright_agreed) then
    raise exception 'All required consents must be confirmed';
  end if;
  if manuscript_row.ethics_policy_version <> '2026-08-01'
     or manuscript_row.ethics_agreed_at is null
     or cardinality(manuscript_row.ethics_author_names) = 0 then
    raise exception 'Research and publication ethics agreement is required';
  end if;
  if not exists (select 1 from public.authors a where a.manuscript_id = target_manuscript_id and a.is_corresponding) then
    raise exception 'A corresponding author is required';
  end if;
  if exists (
    select 1
    from public.authors a
    where a.manuscript_id = target_manuscript_id
      and not (a.name_ko = any(manuscript_row.ethics_author_names))
  ) then
    raise exception 'Every manuscript author must be included in the ethics agreement';
  end if;
  if not exists (
    select 1 from public.manuscript_files f
    where f.manuscript_id = target_manuscript_id
      and f.file_kind = 'ORIGINAL'
      and not f.is_anonymized
  ) then raise exception 'An original manuscript file is required'; end if;

  submission_year := extract(year from timezone('Asia/Seoul', now()))::integer;
  insert into public.manuscript_counters (year, last_number)
  values (submission_year, 1)
  on conflict (year) do update set last_number = public.manuscript_counters.last_number + 1
  returning last_number into sequence_number;

  generated_code := 'KJDHP-' || submission_year::text || '-' ||
    lpad(sequence_number::text, greatest(3, length(sequence_number::text)), '0');

  update public.manuscripts
  set manuscript_code = generated_code,
      status = 'SUBMITTED',
      round_no = 1,
      submitted_at = now()
  where id = target_manuscript_id
  returning * into manuscript_row;

  return manuscript_row;
end;
$$;

create or replace function public.submit_revision(target_manuscript_id uuid)
returns public.manuscripts
language plpgsql
security definer
set search_path = ''
as $$
declare
  manuscript_row public.manuscripts;
  next_round integer;
begin
  select * into manuscript_row from public.manuscripts where id = target_manuscript_id for update;
  if manuscript_row.id is null or manuscript_row.created_by <> auth.uid() then raise exception 'Manuscript not found'; end if;
  if manuscript_row.status <> 'REVISION_REQUESTED' then raise exception 'This manuscript is not awaiting a revision'; end if;
  next_round := manuscript_row.round_no + 1;
  if not exists (
    select 1 from public.manuscript_files f
    where f.manuscript_id = target_manuscript_id
      and f.file_kind = 'REVISION'
      and f.version_no = next_round
      and not f.is_anonymized
  ) then raise exception 'A revision file for the next round is required'; end if;

  update public.manuscripts
  set status = 'REVISION_SUBMITTED', round_no = next_round, current_due_at = null
  where id = target_manuscript_id
  returning * into manuscript_row;
  return manuscript_row;
end;
$$;

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
  target_round integer;
begin
  if not public.is_editorial() then raise exception 'Editorial permission required'; end if;
  if review_due_at <= now() then raise exception 'Review due date must be in the future'; end if;
  if not exists (
    select 1
    from public.profiles p
    join public.profile_roles pr on pr.profile_id = p.id and pr.role = 'REVIEWER'
    where p.id = target_reviewer_id and p.is_active
  ) then raise exception 'Active reviewer not found'; end if;
  if exists (
    select 1 from public.authors a
    where a.manuscript_id = target_manuscript_id and a.user_id = target_reviewer_id
  ) then raise exception 'Authors cannot review their own manuscript'; end if;

  select * into manuscript_row from public.manuscripts where id = target_manuscript_id for update;
  if manuscript_row.id is null then raise exception 'Manuscript not found'; end if;
  if manuscript_row.status not in ('FORMAT_REVIEW', 'REVIEWER_SELECTION', 'REVISION_SUBMITTED', 'RE_REVIEW') then
    raise exception 'Reviewer assignment is not allowed in the current status';
  end if;
  target_round := greatest(manuscript_row.round_no, 1);
  if not exists (
    select 1 from public.manuscript_files f
    where f.manuscript_id = target_manuscript_id
      and f.file_kind = 'ANONYMIZED'
      and f.is_anonymized
      and f.version_no = target_round
  ) then raise exception 'An anonymized manuscript file must be uploaded before reviewer assignment'; end if;

  select count(*) into active_count
  from public.reviewer_assignments ra
  where ra.manuscript_id = target_manuscript_id
    and ra.round_no = target_round
    and ra.status not in ('DECLINED', 'CANCELLED');
  if active_count >= 3 then raise exception 'Three active reviewers are already assigned for this round'; end if;

  select * into assignment_row
  from public.reviewer_assignments ra
  where ra.manuscript_id = target_manuscript_id
    and ra.reviewer_id = target_reviewer_id
    and ra.round_no = target_round
  for update;

  if assignment_row.id is not null then
    if assignment_row.status not in ('DECLINED', 'CANCELLED') then
      raise exception 'Reviewer is already assigned for this round';
    end if;
    update public.reviewer_assignments
    set assigned_by = auth.uid(), status = 'INVITED', due_at = review_due_at,
        responded_at = null, decline_reason = null,
        cancelled_at = null, cancelled_by = null, cancellation_reason = null
    where id = assignment_row.id
    returning * into assignment_row;
  else
    insert into public.reviewer_assignments (manuscript_id, reviewer_id, assigned_by, round_no, due_at)
    values (target_manuscript_id, target_reviewer_id, auth.uid(), target_round, review_due_at)
    returning * into assignment_row;
  end if;

  update public.manuscripts
  set status = case
        when target_round > 1 then 'RE_REVIEW'::public.manuscript_status
        else 'REVIEWER_SELECTION'::public.manuscript_status
      end,
      current_due_at = greatest(coalesce(current_due_at, review_due_at), review_due_at)
  where id = target_manuscript_id;

  return assignment_row;
end;
$$;

create or replace function public.cancel_reviewer_assignment(
  target_assignment_id uuid,
  cancel_reason text default null
)
returns public.reviewer_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.reviewer_assignments;
begin
  if not public.is_editorial() then raise exception 'Editorial permission required'; end if;

  select * into assignment_row
  from public.reviewer_assignments
  where id = target_assignment_id
  for update;
  if assignment_row.id is null then raise exception 'Assignment not found'; end if;
  if assignment_row.status not in ('INVITED', 'ACCEPTED') then
    raise exception 'Only invited or accepted assignments can be cancelled';
  end if;
  if exists (
    select 1 from public.reviews r
    where r.assignment_id = target_assignment_id and r.status = 'SUBMITTED'
  ) then raise exception 'Submitted review assignments cannot be cancelled'; end if;

  update public.reviewer_assignments
  set status = 'CANCELLED', cancelled_at = now(), cancelled_by = auth.uid(),
      cancellation_reason = nullif(trim(coalesce(cancel_reason, '')), '')
  where id = target_assignment_id
  returning * into assignment_row;

  update public.manuscripts m
  set status = case
        when assignment_row.round_no > 1 then 'RE_REVIEW'::public.manuscript_status
        else 'REVIEWER_SELECTION'::public.manuscript_status
      end,
      current_due_at = (
        select max(ra.due_at)
        from public.reviewer_assignments ra
        where ra.manuscript_id = assignment_row.manuscript_id
          and ra.round_no = assignment_row.round_no
          and ra.status not in ('DECLINED', 'CANCELLED')
      )
  where m.id = assignment_row.manuscript_id
    and m.status not in ('WITHDRAWN', 'REJECTED', 'FINAL_ACCEPTED', 'PUBLISHED');

  return assignment_row;
end;
$$;

create or replace function public.get_reviewer_manuscripts()
returns table (
  assignment_id uuid,
  manuscript_id uuid,
  manuscript_code text,
  title_ko text,
  title_en text,
  abstract_ko text,
  abstract_en text,
  keywords_ko text[],
  keywords_en text[],
  research_field text,
  manuscript_status public.manuscript_status,
  assignment_status public.assignment_status,
  round_no integer,
  due_at timestamptz,
  responded_at timestamptz,
  review_status public.review_status,
  recommendation public.review_recommendation,
  review_submitted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ra.id, m.id, m.manuscript_code, m.title_ko, m.title_en,
    m.abstract_ko, m.abstract_en, m.keywords_ko, m.keywords_en,
    m.research_field, m.status, ra.status, ra.round_no, ra.due_at,
    ra.responded_at, r.status, r.recommendation, r.submitted_at
  from public.reviewer_assignments ra
  join public.manuscripts m on m.id = ra.manuscript_id
  left join public.reviews r on r.assignment_id = ra.id
  where ra.reviewer_id = auth.uid()
    and ra.status <> 'CANCELLED'
    and public.has_app_role('REVIEWER')
  order by (ra.status = 'INVITED') desc, ra.due_at asc;
$$;

drop function if exists public.get_reviewer_files(uuid);
create function public.get_reviewer_assignment_files(target_assignment_id uuid)
returns table (
  file_id uuid,
  bucket_id text,
  storage_path text,
  file_kind public.manuscript_file_kind,
  version_no integer,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.bucket_id, f.storage_path, f.file_kind, f.version_no, f.mime_type, f.size_bytes, f.created_at
  from public.reviewer_assignments ra
  join public.manuscript_files f
    on f.manuscript_id = ra.manuscript_id
   and f.version_no = ra.round_no
   and f.file_kind = 'ANONYMIZED'
   and f.is_anonymized
  where ra.id = target_assignment_id
    and ra.reviewer_id = auth.uid()
    and ra.status in ('ACCEPTED', 'COMPLETED')
  order by f.created_at desc
  limit 1;
$$;

drop policy if exists journal_private_files_select on storage.objects;
create policy journal_private_files_select on storage.objects
for select to authenticated
using (
  bucket_id in ('manuscripts', 'revisions', 'final-files', 'review-files')
  and (
    public.is_editorial()
    or exists (
      select 1 from public.manuscripts m
      where m.id::text = (storage.foldername(name))[1]
        and m.created_by = auth.uid()
        and bucket_id <> 'review-files'
    )
    or exists (
      select 1
      from public.manuscript_files f
      join public.reviewer_assignments ra
        on ra.manuscript_id = f.manuscript_id
       and ra.round_no = f.version_no
      where f.bucket_id = storage.objects.bucket_id
        and f.storage_path = storage.objects.name
        and f.is_anonymized
        and f.file_kind = 'ANONYMIZED'
        and ra.reviewer_id = auth.uid()
        and ra.status in ('ACCEPTED', 'COMPLETED')
    )
    or exists (
      select 1 from public.manuscript_files f
      where f.bucket_id = storage.objects.bucket_id
        and f.storage_path = storage.objects.name
        and f.file_kind = 'REVIEW_ATTACHMENT'
        and f.uploaded_by = auth.uid()
    )
  )
);

revoke execute on function public.submit_manuscript(uuid) from public, anon;
revoke execute on function public.submit_revision(uuid) from public, anon;
revoke execute on function public.assign_reviewer(uuid, uuid, timestamptz) from public, anon;
revoke execute on function public.cancel_reviewer_assignment(uuid, text) from public, anon;
revoke execute on function public.get_reviewer_manuscripts() from public, anon;
revoke execute on function public.get_reviewer_assignment_files(uuid) from public, anon;
grant execute on function public.submit_manuscript(uuid) to authenticated;
grant execute on function public.submit_revision(uuid) to authenticated;
grant execute on function public.assign_reviewer(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.cancel_reviewer_assignment(uuid, text) to authenticated;
grant execute on function public.get_reviewer_manuscripts() to authenticated;
grant execute on function public.get_reviewer_assignment_files(uuid) to authenticated;

comment on function public.cancel_reviewer_assignment(uuid, text) is
  '편집진이 미완료 심사배정을 취소하고 취소자·시각·사유를 보존';
comment on function public.get_reviewer_assignment_files(uuid) is
  '심사위원에게 수락 또는 완료된 해당 차수의 최신 익명화 원고 한 건만 제공';
