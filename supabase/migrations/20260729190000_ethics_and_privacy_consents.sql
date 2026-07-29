-- 연구·출판윤리 동의와 회원가입 개인정보 동의를 버전별 감사기록으로 보존한다.

alter table public.manuscripts
  add column ethics_policy_version text,
  add column ethics_agreed_at timestamptz,
  add column ethics_author_names text[] not null default '{}';

comment on column public.manuscripts.ethics_policy_version is '저자 전원이 동의한 연구·출판윤리규정 버전';
comment on column public.manuscripts.ethics_agreed_at is '투고책임자가 저자 전원을 대표해 동의한 시각';
comment on column public.manuscripts.ethics_author_names is '연구·출판윤리규정에 동의한 저자 전원 성명';

create table public.user_consents (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null check (consent_type in ('SERVICE_TERMS', 'PRIVACY_COLLECTION', 'OVERSEAS_TRANSFER', 'ACADEMIC_EMAIL')),
  policy_version text not null,
  is_agreed boolean not null,
  decided_at timestamptz not null default now(),
  unique (profile_id, consent_type, policy_version)
);

create index user_consents_profile_decided_idx on public.user_consents(profile_id, decided_at desc);

alter table public.user_consents enable row level security;

create policy user_consents_select_self_or_admin on public.user_consents
for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

revoke all on public.user_consents from anon, authenticated;
grant select on public.user_consents to authenticated;

grant update (ethics_policy_version, ethics_agreed_at, ethics_author_names)
on public.manuscripts to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submitted_research_fields text[] := '{}';
  submitted_policy_version text;
begin
  if jsonb_typeof(new.raw_user_meta_data -> 'research_fields') = 'array' then
    select coalesce(array_agg(value), '{}')
      into submitted_research_fields
    from jsonb_array_elements_text(new.raw_user_meta_data -> 'research_fields') as fields(value);
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    affiliation,
    phone,
    research_fields,
    role,
    is_active
  )
  values (
    new.id,
    coalesce(new.email, ''),
    trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'affiliation', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    submitted_research_fields,
    'AUTHOR',
    false
  )
  on conflict (id) do nothing;

  submitted_policy_version := nullif(trim(coalesce(new.raw_user_meta_data ->> 'consent_policy_version', '')), '');
  if submitted_policy_version is not null then
    insert into public.user_consents (profile_id, consent_type, policy_version, is_agreed)
    values
      (new.id, 'SERVICE_TERMS', submitted_policy_version, coalesce(new.raw_user_meta_data ->> 'consent_service', 'false') = 'true'),
      (new.id, 'PRIVACY_COLLECTION', submitted_policy_version, coalesce(new.raw_user_meta_data ->> 'consent_privacy', 'false') = 'true'),
      (new.id, 'OVERSEAS_TRANSFER', submitted_policy_version, coalesce(new.raw_user_meta_data ->> 'consent_overseas', 'false') = 'true'),
      (new.id, 'ACADEMIC_EMAIL', submitted_policy_version, coalesce(new.raw_user_meta_data ->> 'consent_academic_email', 'false') = 'true')
    on conflict (profile_id, consent_type, policy_version) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

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
  if not exists (select 1 from public.manuscript_files f where f.manuscript_id = target_manuscript_id and f.file_kind = 'ORIGINAL') then
    raise exception 'An original manuscript file is required';
  end if;
  if not exists (select 1 from public.manuscript_files f where f.manuscript_id = target_manuscript_id and f.file_kind = 'ANONYMIZED' and f.is_anonymized) then
    raise exception 'An anonymized manuscript file is required';
  end if;

  submission_year := extract(year from timezone('Asia/Seoul', now()))::integer;
  insert into public.manuscript_counters (year, last_number)
  values (submission_year, 1)
  on conflict (year) do update set last_number = public.manuscript_counters.last_number + 1
  returning last_number into sequence_number;

  generated_code := 'KJDHF-' || submission_year::text || '-' ||
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

revoke execute on function public.submit_manuscript(uuid) from public, anon;
grant execute on function public.submit_manuscript(uuid) to authenticated;

comment on table public.user_consents is '회원가입 시 약관별 동의·거부 결정과 정책 버전을 보존하는 감사기록';
comment on function public.submit_manuscript(uuid) is '연구·출판윤리 동의 저자와 실제 저자를 검증한 뒤 논문번호를 발급';
