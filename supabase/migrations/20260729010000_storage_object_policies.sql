-- storage.objects는 supabase_storage_admin 소유이다.
-- Supabase CLI 또는 Dashboard migration runner처럼 해당 소유권을 가진 실행 경로에서 적용한다.

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
      join public.reviewer_assignments ra on ra.manuscript_id = f.manuscript_id
      where f.bucket_id = storage.objects.bucket_id
        and f.storage_path = storage.objects.name
        and f.is_anonymized
        and f.file_kind in ('ANONYMIZED', 'REVISION')
        and ra.reviewer_id = auth.uid()
        and ra.status in ('INVITED', 'ACCEPTED', 'COMPLETED')
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

create policy journal_author_files_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('manuscripts', 'revisions', 'final-files')
  and exists (
    select 1 from public.manuscripts m
    where m.id::text = (storage.foldername(name))[1]
      and m.created_by = auth.uid()
      and (
        (bucket_id = 'manuscripts' and m.status = 'DRAFT')
        or (bucket_id = 'revisions' and m.status = 'REVISION_REQUESTED')
        or (bucket_id = 'final-files' and m.status in ('ACCEPTED', 'ACCEPT_WITH_REVISIONS'))
      )
  )
);

create policy journal_reviewer_files_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'review-files'
  and exists (
    select 1 from public.reviewer_assignments ra
    where ra.manuscript_id::text = (storage.foldername(name))[1]
      and ra.reviewer_id = auth.uid()
      and ra.status = 'ACCEPTED'
  )
);

create policy journal_editor_files_insert on storage.objects
for insert to authenticated
with check (
  public.is_editorial()
  and bucket_id in ('manuscripts', 'revisions', 'review-files', 'final-files')
  and exists (
    select 1 from public.manuscripts m
    where m.id::text = (storage.foldername(name))[1]
  )
);

create policy journal_published_files_admin_select on storage.objects
for select to authenticated
using (bucket_id = 'published' and public.is_admin());

create policy journal_published_files_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'published'
  and public.is_admin()
  and exists (
    select 1 from public.manuscripts m
    where m.id::text = (storage.foldername(name))[1]
      and m.status in ('FINAL_ACCEPTED', 'PUBLISHED')
  )
);

comment on policy journal_private_files_select on storage.objects is
  '저자는 자기 논문 파일, Reviewer는 배정된 익명 파일, 편집진은 편집업무 파일만 열람';
