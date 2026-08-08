-- 여러 HWPX 논문 양식을 공개 제공하고 교정·검수 지원 안내 페이지를 추가한다.

create table public.journal_template_files (
  id uuid primary key default gen_random_uuid(),
  file_name text not null check (length(trim(file_name)) > 5 and lower(file_name) like '%.hwpx'),
  storage_path text not null unique check (storage_path like 'templates/%.hwpx'),
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  display_order integer not null default 0 check (display_order >= 0),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index journal_template_files_order_idx
  on public.journal_template_files(display_order, created_at);

create trigger journal_template_files_set_updated_at before update on public.journal_template_files
for each row execute function public.set_updated_at();

alter table public.journal_template_files enable row level security;

create policy journal_template_files_public_read on public.journal_template_files
for select to anon, authenticated
using (true);

create policy journal_template_files_admin_insert on public.journal_template_files
for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());

create policy journal_template_files_admin_update on public.journal_template_files
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy journal_template_files_admin_delete on public.journal_template_files
for delete to authenticated
using (public.is_admin());

revoke all on public.journal_template_files from anon, authenticated;
grant select on public.journal_template_files to anon, authenticated;
grant insert, update, delete on public.journal_template_files to authenticated;

insert into public.journal_template_files (
  file_name,
  storage_path,
  mime_type,
  size_bytes,
  display_order,
  created_by
)
select
  attachment_name,
  attachment_path,
  coalesce(attachment_mime_type, 'application/octet-stream'),
  attachment_size_bytes,
  0,
  author_id
from public.board_posts
where title = 'KJDHF_PAGE:manuscript-template'
  and attachment_name is not null
  and lower(attachment_name) like '%.hwpx'
  and attachment_path is not null
  and attachment_size_bytes between 1 and 20971520
on conflict (storage_path) do nothing;

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/haansofthwp',
      'application/x-hwp',
      'application/vnd.hancom.hwp',
      'application/vnd.hancom.hwpx',
      'application/zip',
      'application/octet-stream'
    ]
where id = 'published';

-- HWPX는 브라우저와 운영체제에 따라 전용 MIME, ZIP 또는 octet-stream으로 전달될 수 있다.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/haansofthwp',
      'application/x-hwp',
      'application/vnd.hancom.hwpx',
      'application/zip',
      'application/octet-stream'
    ]
where id in ('manuscripts', 'revisions', 'final-files');

insert into public.board_posts (
  category,
  title,
  content,
  is_pinned,
  is_published,
  published_at,
  author_id
)
select
  'NOTICE',
  'KJDHF_PAGE:proofreading-support',
  E'논문 교정·검수 지원 안내\n\n원고의 문장 교정, 영문 검수, 표·그림 및 참고문헌 형식 점검이 필요한 저자를 위해 외부 전문업체 정보를 안내할 수 있습니다.\n\n이용 유의사항\n1. 교정·검수 서비스 이용은 저자의 자율적인 선택이며 투고·심사·게재의 필수 요건이 아닙니다.\n2. 특정 업체의 이용 여부는 심사 및 게재 판정에 어떠한 영향도 주지 않습니다.\n3. 서비스 범위, 비용, 일정, 계약 및 개인정보 처리 사항은 저자가 업체와 직접 확인해야 합니다.\n4. 건강체력연구소와 학술지 편집위원회는 외부업체의 서비스 품질 또는 결과를 보증하지 않습니다.\n5. 업체 정보는 저자 편의를 위한 참고자료이며 특정 업체를 추천하거나 이용을 강제하는 것이 아닙니다.',
  false,
  true,
  now(),
  null
where not exists (
  select 1 from public.board_posts where title = 'KJDHF_PAGE:proofreading-support'
);

comment on table public.journal_template_files is
  '공개 투고규정 페이지에서 내려받는 HWPX 논문 양식 목록';
