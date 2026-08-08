-- 비공개 원고·심사자료와 공개 발행 PDF를 분리하는 Storage 정책

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('manuscripts', 'manuscripts', false, 52428800, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/haansofthwp', 'application/x-hwp', 'application/vnd.hancom.hwpx', 'application/zip', 'application/octet-stream']),
  ('revisions', 'revisions', false, 52428800, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/haansofthwp', 'application/x-hwp', 'application/vnd.hancom.hwpx', 'application/zip', 'application/octet-stream']),
  ('review-files', 'review-files', false, 20971520, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']),
  ('final-files', 'final-files', false, 52428800, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/haansofthwp', 'application/x-hwp', 'application/vnd.hancom.hwpx', 'application/zip', 'application/octet-stream']),
  ('published', 'published', true, 52428800, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
