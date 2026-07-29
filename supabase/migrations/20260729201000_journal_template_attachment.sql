-- 관리자가 공개 논문 양식을 첨부하고 방문자가 내려받을 수 있게 한다.

alter table public.board_posts
  add column if not exists attachment_name text,
  add column if not exists attachment_path text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size_bytes bigint;

alter table public.board_posts
  drop constraint if exists board_posts_attachment_size_check;

alter table public.board_posts
  add constraint board_posts_attachment_size_check
  check (attachment_size_bytes is null or attachment_size_bytes between 1 and 20971520);

comment on column public.board_posts.attachment_path is
  'published bucket의 공개 학회지 안내 첨부파일 경로';

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/haansofthwp',
      'application/x-hwp',
      'application/vnd.hancom.hwp',
      'application/zip',
      'application/octet-stream'
    ]
where id = 'published';

drop policy if exists journal_template_files_admin_insert on storage.objects;
drop policy if exists journal_template_files_admin_delete on storage.objects;

create policy journal_template_files_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'published'
  and (storage.foldername(name))[1] = 'templates'
  and public.is_admin()
);

create policy journal_template_files_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'published'
  and (storage.foldername(name))[1] = 'templates'
  and public.is_admin()
);
