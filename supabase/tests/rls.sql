-- 운영 데이터에 흔적을 남기지 않는 RLS 회귀 테스트
-- Supabase SQL Editor 또는 MCP execute_sql에서 한 번에 실행한다.

begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'author1.test@example.invalid', crypt('Test-password-1!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"저자 1"}', now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'author2.test@example.invalid', crypt('Test-password-1!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"저자 2"}', now(), now()),
  ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'reviewer.test@example.invalid', crypt('Test-password-1!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"심사위원"}', now(), now()),
  ('30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'editor.test@example.invalid', crypt('Test-password-1!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"편집위원"}', now(), now()),
  ('40000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin.test@example.invalid', crypt('Test-password-1!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"관리자"}', now(), now());

update public.profiles set role = 'REVIEWER' where id = '20000000-0000-0000-0000-000000000001';
update public.profiles set role = 'EDITOR' where id = '30000000-0000-0000-0000-000000000001';
update public.profiles set role = 'ADMIN' where id = '40000000-0000-0000-0000-000000000001';
update public.profiles set is_active = true, approved_at = now();

insert into public.manuscripts (
  id, manuscript_code, created_by, status, round_no, title_ko, title_en,
  abstract_ko, abstract_en, keywords_ko, keywords_en, research_field,
  ethics_confirmed, conflict_of_interest_confirmed, copyright_agreed, submitted_at
)
values
  ('50000000-0000-0000-0000-000000000001', 'KJDHF-2026-901', '10000000-0000-0000-0000-000000000001', 'UNDER_REVIEW', 1, '저자 1 논문', 'Author One Paper', '국문초록', 'English abstract', array['체력'], array['fitness'], '건강체력 측정·평가', true, true, true, now()),
  ('50000000-0000-0000-0000-000000000002', 'KJDHF-2026-902', '10000000-0000-0000-0000-000000000002', 'SUBMITTED', 1, '저자 2 논문', 'Author Two Paper', '국문초록', 'English abstract', array['운동'], array['exercise'], '운동생리학', true, true, true, now());

insert into public.authors (manuscript_id, user_id, name_ko, affiliation_ko, email, is_corresponding, sort_order)
values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '저자 1', 'A대학교', 'author1.test@example.invalid', true, 1),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '저자 2', 'B대학교', 'author2.test@example.invalid', true, 1);

insert into public.reviewer_assignments (id, manuscript_id, reviewer_id, assigned_by, round_no, status, due_at)
values ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'ACCEPTED', now() + interval '14 days');

insert into public.reviews (assignment_id, recommendation, author_comments, editor_comments, status, submitted_at)
values ('60000000-0000-0000-0000-000000000001', 'RE_REVIEW', '저자 공개 심사의견', '편집위원 전용 의견', 'SUBMITTED', now());

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.manuscripts) <> 1 then raise exception 'Author can see another author manuscript'; end if;
  if (select count(*) from public.manuscripts where id = '50000000-0000-0000-0000-000000000002') <> 0 then raise exception 'Direct manuscript URL isolation failed'; end if;
  if (select count(*) from public.reviewer_assignments) <> 0 then raise exception 'Author can see reviewer identity'; end if;
  if (select count(*) from public.reviews) <> 0 then raise exception 'Author can see reviewer record'; end if;
  if (select count(*) from public.profiles where id = '20000000-0000-0000-0000-000000000001') <> 0 then raise exception 'Author can see reviewer profile'; end if;
  begin
    update public.profiles set role = 'ADMIN' where id = auth.uid();
    raise exception 'User role self-promotion was not blocked';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.manuscripts) <> 0 then raise exception 'Reviewer can query manuscripts directly'; end if;
  if (select count(*) from public.authors) <> 0 then raise exception 'Reviewer can see author PII'; end if;
  if (select count(*) from public.get_reviewer_manuscripts()) <> 1 then raise exception 'Reviewer cannot see assigned blinded manuscript'; end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'get_reviewer_manuscripts'
      and column_name in ('created_by', 'email', 'affiliation', 'reviewer_id')
  ) then raise exception 'Blinded reviewer function exposes identity columns'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.manuscripts) <> 2 then raise exception 'Editor cannot see the editorial queue'; end if;
  if (select count(*) from public.authors) <> 2 then raise exception 'Editor cannot perform authorship checks'; end if;
  if (select count(*) from public.reviews) <> 1 then raise exception 'Editor cannot see submitted reviews'; end if;
end;
$$;

reset role;
rollback;

select 'all_rls_checks_passed' as result;
