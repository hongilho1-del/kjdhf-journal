-- 학술지 영문 약칭에 맞춰 원고번호 접두사를 KJDHP로 통일한다.

alter table public.manuscripts
  drop constraint if exists manuscript_code_format;

update public.manuscripts
set manuscript_code = regexp_replace(manuscript_code, '^KJDHF-', 'KJDHP-')
where manuscript_code ~ '^KJDHF-[0-9]{4}-[0-9]{3,}$';

alter table public.manuscripts
  add constraint manuscript_code_format
  check (manuscript_code is null or manuscript_code ~ '^KJDHP-[0-9]{4}-[0-9]{3,}$');

-- 삭제된 테스트 투고번호는 다시 사용할 수 있도록 실제 원고번호의 최댓값에 맞춘다.
update public.manuscript_counters counter
set last_number = coalesce((
  select max(split_part(manuscript.manuscript_code, '-', 3)::integer)
  from public.manuscripts manuscript
  where manuscript.manuscript_code ~ ('^KJDHP-' || counter.year::text || '-[0-9]{3,}$')
), 0);

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

revoke execute on function public.submit_manuscript(uuid) from public, anon;
grant execute on function public.submit_manuscript(uuid) to authenticated;

comment on function public.submit_manuscript(uuid) is
  '연구·출판윤리 동의 저자와 실제 저자를 검증한 뒤 KJDHP 원고번호를 발급';
