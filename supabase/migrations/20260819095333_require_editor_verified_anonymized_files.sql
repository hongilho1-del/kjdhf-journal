-- 심사위원에게 공개할 익명 원고는 편집진이 직접 등록한 파일만 인정한다.
-- 이전에 저자가 자동 생성한 ANONYMIZED 행은 검증값이 null이므로 심사에 사용되지 않는다.

alter table public.manuscript_files
  add column if not exists editor_verified_at timestamptz,
  add column if not exists editor_verified_by uuid references public.profiles(id) on delete restrict;

alter table public.manuscript_files
  drop constraint if exists manuscript_files_editor_verification_check;
alter table public.manuscript_files
  add constraint manuscript_files_editor_verification_check check (
    (editor_verified_at is null and editor_verified_by is null)
    or (
      editor_verified_at is not null
      and editor_verified_by is not null
      and file_kind = 'ANONYMIZED'
      and is_anonymized
    )
  );

drop policy if exists files_insert_author_reviewer_or_editor on public.manuscript_files;
create policy files_insert_author_reviewer_or_editor on public.manuscript_files
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    (
      public.is_editorial()
      and (
        (
          file_kind = 'ANONYMIZED'
          and bucket_id = 'manuscripts'
          and is_anonymized
          and editor_verified_by = auth.uid()
          and editor_verified_at is not null
        )
        or (
          file_kind <> 'ANONYMIZED'
          and editor_verified_at is null
          and editor_verified_by is null
          and (file_kind <> 'PUBLISHED' or public.is_admin())
        )
      )
    )
    or exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_id
        and m.created_by = auth.uid()
        and editor_verified_at is null
        and editor_verified_by is null
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
      and editor_verified_at is null
      and editor_verified_by is null
      and exists (
        select 1 from public.reviewer_assignments ra
        where ra.manuscript_id = manuscript_id
          and ra.reviewer_id = auth.uid()
          and ra.status = 'ACCEPTED'
      )
    )
  )
);

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
      and f.editor_verified_at is not null
      and f.editor_verified_by is not null
  ) then raise exception 'An editor-verified anonymized manuscript file must be uploaded before reviewer assignment'; end if;

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

create or replace function public.get_reviewer_assignment_files(target_assignment_id uuid)
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
   and f.editor_verified_at is not null
   and f.editor_verified_by is not null
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
        and f.editor_verified_at is not null
        and f.editor_verified_by is not null
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

revoke execute on function public.assign_reviewer(uuid, uuid, timestamptz) from public, anon;
revoke execute on function public.get_reviewer_assignment_files(uuid) from public, anon;
grant execute on function public.assign_reviewer(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.get_reviewer_assignment_files(uuid) to authenticated;
