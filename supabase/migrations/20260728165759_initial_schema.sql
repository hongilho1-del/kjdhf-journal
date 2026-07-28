-- 한국 디지털 건강체력학회지 투고·심사 시스템 핵심 스키마

create extension if not exists pgcrypto;

create type public.app_role as enum ('AUTHOR', 'REVIEWER', 'EDITOR', 'ADMIN');
create type public.manuscript_status as enum (
  'DRAFT',
  'SUBMITTED',
  'RECEIVED',
  'FORMAT_REVIEW',
  'REVIEWER_SELECTION',
  'UNDER_REVIEW',
  'REVISION_REQUESTED',
  'REVISION_SUBMITTED',
  'RE_REVIEW',
  'ACCEPTED',
  'ACCEPT_WITH_REVISIONS',
  'REJECTED',
  'FINAL_ACCEPTED',
  'PUBLISHED'
);
create type public.assignment_status as enum ('INVITED', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'CANCELLED');
create type public.review_status as enum ('DRAFT', 'SUBMITTED');
create type public.review_recommendation as enum ('ACCEPT', 'ACCEPT_WITH_REVISIONS', 'RE_REVIEW', 'REJECT');
create type public.editorial_decision_type as enum ('REVISION_REQUESTED', 'ACCEPTED', 'ACCEPT_WITH_REVISIONS', 'REJECTED', 'FINAL_ACCEPTED');
create type public.manuscript_file_kind as enum ('ORIGINAL', 'ANONYMIZED', 'REVISION', 'FINAL', 'REVIEW_ATTACHMENT', 'PUBLISHED');
create type public.issue_status as enum ('DRAFT', 'PUBLISHED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role public.app_role not null default 'AUTHOR',
  affiliation text,
  phone text,
  research_fields text[] not null default '{}',
  reviewer_bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_role_history (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  old_role public.app_role,
  new_role public.app_role not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table public.manuscript_counters (
  year integer primary key check (year between 2020 and 9999),
  last_number integer not null default 0 check (last_number >= 0)
);

create table public.manuscripts (
  id uuid primary key default gen_random_uuid(),
  manuscript_code text unique,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  status public.manuscript_status not null default 'DRAFT',
  round_no integer not null default 0 check (round_no >= 0),
  title_ko text not null,
  title_en text not null,
  abstract_ko text not null,
  abstract_en text not null,
  keywords_ko text[] not null default '{}',
  keywords_en text[] not null default '{}',
  research_field text not null,
  ethics_confirmed boolean not null default false,
  conflict_of_interest_confirmed boolean not null default false,
  copyright_agreed boolean not null default false,
  submitted_at timestamptz,
  current_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manuscript_code_format check (manuscript_code is null or manuscript_code ~ '^KJDHF-[0-9]{4}-[0-9]{3,}$'),
  constraint submission_consents_required check (
    status = 'DRAFT'
    or (ethics_confirmed and conflict_of_interest_confirmed and copyright_agreed)
  )
);

create table public.authors (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name_ko text not null,
  name_en text,
  affiliation_ko text not null,
  affiliation_en text,
  email text not null,
  is_corresponding boolean not null default false,
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manuscript_id, sort_order)
);

create unique index authors_one_corresponding_per_manuscript
  on public.authors(manuscript_id)
  where is_corresponding;

create table public.manuscript_files (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  bucket_id text not null check (bucket_id in ('manuscripts', 'revisions', 'review-files', 'final-files', 'published')),
  storage_path text not null unique,
  file_kind public.manuscript_file_kind not null,
  version_no integer not null default 1 check (version_no > 0),
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  checksum_sha256 text,
  is_anonymized boolean not null default false,
  uploaded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  round_no integer not null default 1 check (round_no > 0),
  status public.assignment_status not null default 'INVITED',
  due_at timestamptz not null,
  responded_at timestamptz,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manuscript_id, reviewer_id, round_no)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.reviewer_assignments(id) on delete cascade,
  recommendation public.review_recommendation,
  author_comments text not null default '',
  editor_comments text not null default '',
  status public.review_status not null default 'DRAFT',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submitted_review_complete check (
    status = 'DRAFT'
    or (recommendation is not null and length(trim(author_comments)) > 0 and submitted_at is not null)
  )
);

create table public.editorial_decisions (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  round_no integer not null check (round_no >= 0),
  decision public.editorial_decision_type not null,
  author_letter text not null,
  internal_note text,
  decided_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  decided_at timestamptz not null default now()
);

create table public.manuscript_status_history (
  id bigint generated always as identity primary key,
  manuscript_id uuid not null references public.manuscripts(id) on delete cascade,
  from_status public.manuscript_status,
  to_status public.manuscript_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  changed_at timestamptz not null default now()
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2020 and 9999),
  volume integer not null check (volume > 0),
  issue_number integer not null check (issue_number > 0),
  title text,
  publication_date date,
  status public.issue_status not null default 'DRAFT',
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, volume, issue_number)
);

create table public.published_articles (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null unique references public.manuscripts(id) on delete restrict,
  issue_id uuid not null references public.issues(id) on delete restrict,
  article_order integer not null check (article_order > 0),
  page_start integer check (page_start is null or page_start > 0),
  page_end integer check (page_end is null or page_end >= page_start),
  doi text unique,
  title_ko text not null,
  title_en text not null,
  abstract_ko text not null,
  abstract_en text not null,
  keywords_ko text[] not null default '{}',
  keywords_en text[] not null default '{}',
  pdf_file_id uuid references public.manuscript_files(id) on delete restrict,
  published_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  unique (issue_id, article_order)
);

create index manuscripts_created_by_idx on public.manuscripts(created_by, created_at desc);
create index manuscripts_status_idx on public.manuscripts(status, submitted_at desc);
create index authors_manuscript_idx on public.authors(manuscript_id, sort_order);
create index manuscript_files_manuscript_idx on public.manuscript_files(manuscript_id, version_no desc);
create index reviewer_assignments_reviewer_idx on public.reviewer_assignments(reviewer_id, status, due_at);
create index reviewer_assignments_manuscript_idx on public.reviewer_assignments(manuscript_id, round_no, status);
create index decisions_manuscript_idx on public.editorial_decisions(manuscript_id, decided_at desc);
create index status_history_manuscript_idx on public.manuscript_status_history(manuscript_id, changed_at desc);
create index published_articles_issue_idx on public.published_articles(issue_id, article_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger manuscripts_set_updated_at before update on public.manuscripts
for each row execute function public.set_updated_at();
create trigger authors_set_updated_at before update on public.authors
for each row execute function public.set_updated_at();
create trigger assignments_set_updated_at before update on public.reviewer_assignments
for each row execute function public.set_updated_at();
create trigger reviews_set_updated_at before update on public.reviews
for each row execute function public.set_updated_at();
create trigger issues_set_updated_at before update on public.issues
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.record_manuscript_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.manuscript_status_history (manuscript_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.manuscript_status_history (manuscript_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger manuscripts_record_status
after insert or update of status on public.manuscripts
for each row execute function public.record_manuscript_status_history();

create or replace function public.record_profile_role_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role then
    insert into public.profile_role_history (profile_id, old_role, new_role, changed_by)
    values (new.id, old.role, new.role, auth.uid());
  end if;
  return new;
end;
$$;

create trigger profiles_record_role_change
after update of role on public.profiles
for each row execute function public.record_profile_role_history();

comment on table public.profiles is 'Supabase Auth 사용자와 연결된 학술지 사용자 프로필 및 역할';
comment on table public.manuscripts is '논문 비식별 원문 메타데이터와 현재 워크플로 상태';
comment on table public.authors is 'Reviewer에게 직접 공개되지 않는 저자·소속·연락처 정보';
comment on table public.reviewer_assignments is '논문별·회차별 심사위원 배정과 수락 상태';
comment on table public.reviews is '저자 공개용 의견과 편집위원 전용 의견을 분리한 심사 결과';
comment on table public.manuscript_status_history is '모든 논문 상태 변경의 불변 이력';
