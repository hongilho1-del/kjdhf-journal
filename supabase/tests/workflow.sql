-- 15단계 핵심 운영 시나리오 통합 테스트. 전체 트랜잭션을 마지막에 롤백한다.

begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('11000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'workflow.author@example.invalid', crypt('Test-password-1!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"통합테스트 저자"}', now(), now()),
  ('21000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'workflow.reviewer1@example.invalid', crypt('Test-password-1!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"통합테스트 심사위원1"}', now(), now()),
  ('21000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'workflow.reviewer2@example.invalid', crypt('Test-password-1!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"통합테스트 심사위원2"}', now(), now()),
  ('31000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'workflow.editor@example.invalid', crypt('Test-password-1!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"통합테스트 편집위원"}', now(), now()),
  ('41000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'workflow.admin@example.invalid', crypt('Test-password-1!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"통합테스트 관리자"}', now(), now());

update public.profiles set role = 'REVIEWER' where id in ('21000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002');
update public.profiles set role = 'EDITOR' where id = '31000000-0000-0000-0000-000000000001';
update public.profiles set role = 'ADMIN' where id = '41000000-0000-0000-0000-000000000001';

-- 1~4. 신규 저자 로그인 상태에서 투고정보·저자·원고파일을 등록하고 manuscript ID를 발급한다.
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.manuscripts (id, title_ko, title_en, abstract_ko, abstract_en, keywords_ko, keywords_en, research_field, ethics_confirmed, conflict_of_interest_confirmed, copyright_agreed)
values ('51000000-0000-0000-0000-000000000001', '디지털 기반 건강체력 평가 연구', 'Digital Health Fitness Assessment', '통합테스트 국문초록', 'Workflow integration abstract', array['디지털헬스','건강체력'], array['digital health','fitness'], '디지털 헬스', true, true, true);
insert into public.authors (manuscript_id, user_id, name_ko, affiliation_ko, email, is_corresponding, sort_order)
values ('51000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', '통합테스트 저자', '테스트대학교', 'workflow.author@example.invalid', true, 1);
insert into public.manuscript_files (manuscript_id, bucket_id, storage_path, file_kind, version_no, original_name, mime_type, size_bytes, is_anonymized)
values
  ('51000000-0000-0000-0000-000000000001', 'manuscripts', '51000000-0000-0000-0000-000000000001/1/original.docx', 'ORIGINAL', 1, 'original.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024, false),
  ('51000000-0000-0000-0000-000000000001', 'manuscripts', '51000000-0000-0000-0000-000000000001/1/blinded.docx', 'ANONYMIZED', 1, 'blinded.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024, true);
select public.submit_manuscript('51000000-0000-0000-0000-000000000001');
do $$ begin
  if not exists (select 1 from public.manuscripts where id = '51000000-0000-0000-0000-000000000001' and manuscript_code ~ '^KJDHF-[0-9]{4}-[0-9]{3,}$' and status = 'SUBMITTED') then
    raise exception 'Manuscript submission or ID generation failed';
  end if;
end $$;

-- 5~6. 편집위원이 접수·형식검토 후 2명의 심사위원을 배정한다.
reset role;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.advance_manuscript_status('51000000-0000-0000-0000-000000000001', 'RECEIVED', '접수확인');
select public.advance_manuscript_status('51000000-0000-0000-0000-000000000001', 'FORMAT_REVIEW', '형식검토 완료');
select public.assign_reviewer('51000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', now() + interval '14 days');
select public.assign_reviewer('51000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002', now() + interval '14 days');

-- 7~9. 각 Reviewer가 의뢰를 수락하고 익명 원고를 확인한 뒤 심사결과를 제출한다.
reset role;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.respond_to_review_assignment((select id from public.reviewer_assignments where reviewer_id = auth.uid() and round_no = 1), true, null);
select public.submit_review((select id from public.reviewer_assignments where reviewer_id = auth.uid() and round_no = 1), 'RE_REVIEW', '측정방법을 보완해 주세요.', '수정 후 재심을 권고합니다.');

reset role;
select set_config('request.jwt.claim.sub', '21000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select public.respond_to_review_assignment((select id from public.reviewer_assignments where reviewer_id = auth.uid() and round_no = 1), true, null);
select public.submit_review((select id from public.reviewer_assignments where reviewer_id = auth.uid() and round_no = 1), 'ACCEPT_WITH_REVISIONS', '논의를 보완해 주세요.', '수정후게재가 적절합니다.');

-- 10~11. Editor가 결과를 확인하고 수정요청을 기록한다.
reset role;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.record_editorial_decision('51000000-0000-0000-0000-000000000001', 'REVISION_REQUESTED', '두 심사의견을 반영해 수정본을 제출해 주세요.', '1차 심사 완료');

-- 12. Author가 익명화 수정본을 제출한다.
reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.manuscript_files (manuscript_id, bucket_id, storage_path, file_kind, version_no, original_name, mime_type, size_bytes, is_anonymized)
values ('51000000-0000-0000-0000-000000000001', 'revisions', '51000000-0000-0000-0000-000000000001/2/revision.docx', 'REVISION', 2, 'revision.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024, true);
select public.submit_revision('51000000-0000-0000-0000-000000000001');

-- 13. Editor가 재심사 후 게재가 판정을 입력한다.
reset role;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.assign_reviewer('51000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', now() + interval '7 days');
select public.assign_reviewer('51000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002', now() + interval '7 days');
select public.record_editorial_decision('51000000-0000-0000-0000-000000000001', 'ACCEPTED', '수정사항이 반영되어 게재가로 판정합니다.', '재심사 확인 완료');

-- 14. Author가 최종원고를 제출하고 Editor가 게재확정한다.
reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.manuscript_files (manuscript_id, bucket_id, storage_path, file_kind, version_no, original_name, mime_type, size_bytes, is_anonymized)
values ('51000000-0000-0000-0000-000000000001', 'final-files', '51000000-0000-0000-0000-000000000001/2/final.docx', 'FINAL', 2, 'final.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024, false);

reset role;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select public.record_editorial_decision('51000000-0000-0000-0000-000000000001', 'FINAL_ACCEPTED', '최종원고를 확인하고 게재를 확정합니다.', '최종 편집원고 확인');

-- 15. ADMIN이 발행호와 최종 PDF를 연결하고 발행완료 처리한다.
reset role;
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into public.issues (id, year, volume, issue_number, title, publication_date, status)
values ('71000000-0000-0000-0000-000000000001', 2026, 1, 1, '창간호', current_date, 'PUBLISHED');
insert into public.manuscript_files (id, manuscript_id, bucket_id, storage_path, file_kind, version_no, original_name, mime_type, size_bytes, is_anonymized)
values ('72000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'published', '51000000-0000-0000-0000-000000000001/2/article.pdf', 'PUBLISHED', 2, 'article.pdf', 'application/pdf', 2048, false);
insert into public.published_articles (manuscript_id, issue_id, article_order, page_start, page_end, title_ko, title_en, abstract_ko, abstract_en, keywords_ko, keywords_en, pdf_file_id)
select id, '71000000-0000-0000-0000-000000000001', 1, 1, 12, title_ko, title_en, abstract_ko, abstract_en, keywords_ko, keywords_en, '72000000-0000-0000-0000-000000000001'
from public.manuscripts where id = '51000000-0000-0000-0000-000000000001';
select public.advance_manuscript_status('51000000-0000-0000-0000-000000000001', 'PUBLISHED', '창간호 발행');

do $$
begin
  if not exists (select 1 from public.manuscripts where id = '51000000-0000-0000-0000-000000000001' and status = 'PUBLISHED') then raise exception 'Final publication status failed'; end if;
  if (select count(*) from public.manuscript_status_history where manuscript_id = '51000000-0000-0000-0000-000000000001') < 10 then raise exception 'Status audit history is incomplete'; end if;
  if (select count(*) from public.reviewer_assignments where manuscript_id = '51000000-0000-0000-0000-000000000001' and round_no = 1) <> 2 then raise exception 'Two-reviewer assignment failed'; end if;
  if (select count(*) from public.reviews r join public.reviewer_assignments ra on ra.id = r.assignment_id where ra.manuscript_id = '51000000-0000-0000-0000-000000000001' and r.status = 'SUBMITTED') <> 2 then raise exception 'Review submission failed'; end if;
end $$;

reset role;
rollback;

select 'all_workflow_checks_passed' as result;
