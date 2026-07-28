-- Storage 객체 메타데이터 위조를 막기 위해 상태·종류·Bucket 조합을 함께 검증한다.

drop policy files_insert_author_reviewer_or_editor on public.manuscript_files;

create policy files_insert_author_reviewer_or_editor on public.manuscript_files
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    (
      public.is_editorial()
      and (
        file_kind <> 'PUBLISHED'
        or public.is_admin()
      )
    )
    or exists (
      select 1 from public.manuscripts m
      where m.id = manuscript_id
        and m.created_by = auth.uid()
        and (
          (file_kind = 'ORIGINAL' and bucket_id = 'manuscripts' and m.status = 'DRAFT')
          or (file_kind = 'ANONYMIZED' and bucket_id = 'manuscripts' and is_anonymized and m.status = 'DRAFT')
          or (file_kind = 'REVISION' and bucket_id = 'revisions' and is_anonymized and m.status = 'REVISION_REQUESTED')
          or (file_kind = 'FINAL' and bucket_id = 'final-files' and m.status in ('ACCEPTED', 'ACCEPT_WITH_REVISIONS'))
        )
    )
    or (
      public.current_app_role() = 'REVIEWER'
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
