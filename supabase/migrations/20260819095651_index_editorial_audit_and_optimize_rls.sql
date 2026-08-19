-- 편집 이력 FK와 심사용 익명 원고 조회 경로를 인덱싱한다.
create index if not exists reviewer_assignments_assigned_by_idx
  on public.reviewer_assignments (assigned_by);
create index if not exists reviewer_assignments_cancelled_by_idx
  on public.reviewer_assignments (cancelled_by)
  where cancelled_by is not null;
create index if not exists manuscript_files_editor_verified_by_idx
  on public.manuscript_files (editor_verified_by)
  where editor_verified_by is not null;
create index if not exists manuscript_files_verified_anonymized_idx
  on public.manuscript_files (manuscript_id, version_no, created_at desc)
  where file_kind = 'ANONYMIZED'
    and is_anonymized
    and editor_verified_at is not null;

-- 인증·역할 함수는 정책 행마다 재평가하지 않고 statement init plan에서 한 번만 평가한다.
drop policy if exists files_insert_author_reviewer_or_editor on public.manuscript_files;
create policy files_insert_author_reviewer_or_editor on public.manuscript_files
for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (
    (
      (select public.is_editorial())
      and (
        (
          file_kind = 'ANONYMIZED'
          and bucket_id = 'manuscripts'
          and is_anonymized
          and editor_verified_by = (select auth.uid())
          and editor_verified_at is not null
        )
        or (
          file_kind <> 'ANONYMIZED'
          and editor_verified_at is null
          and editor_verified_by is null
          and (file_kind <> 'PUBLISHED' or (select public.is_admin()))
        )
      )
    )
    or exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_id
        and m.created_by = (select auth.uid())
        and editor_verified_at is null
        and editor_verified_by is null
        and (
          (file_kind = 'ORIGINAL' and bucket_id = 'manuscripts' and not is_anonymized and m.status = 'DRAFT')
          or (file_kind = 'REVISION' and bucket_id = 'revisions' and not is_anonymized and m.status = 'REVISION_REQUESTED')
          or (file_kind = 'FINAL' and bucket_id = 'final-files' and not is_anonymized and m.status in ('ACCEPTED', 'ACCEPT_WITH_REVISIONS'))
        )
    )
    or (
      (select public.has_app_role('REVIEWER'))
      and file_kind = 'REVIEW_ATTACHMENT'
      and bucket_id = 'review-files'
      and editor_verified_at is null
      and editor_verified_by is null
      and exists (
        select 1 from public.reviewer_assignments ra
        where ra.manuscript_id = manuscript_id
          and ra.reviewer_id = (select auth.uid())
          and ra.status = 'ACCEPTED'
      )
    )
  )
);

drop policy if exists journal_private_files_select on storage.objects;
create policy journal_private_files_select on storage.objects
for select to authenticated
using (
  bucket_id in ('manuscripts', 'revisions', 'final-files', 'review-files')
  and (
    (select public.is_editorial())
    or exists (
      select 1 from public.manuscripts m
      where m.id::text = (storage.foldername(name))[1]
        and m.created_by = (select auth.uid())
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
        and ra.reviewer_id = (select auth.uid())
        and ra.status in ('ACCEPTED', 'COMPLETED')
    )
    or exists (
      select 1 from public.manuscript_files f
      where f.bucket_id = storage.objects.bucket_id
        and f.storage_path = storage.objects.name
        and f.file_kind = 'REVIEW_ATTACHMENT'
        and f.uploaded_by = (select auth.uid())
    )
  )
);
