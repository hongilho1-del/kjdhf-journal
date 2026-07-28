-- 역할 기반 접근제어, 이중맹검 조회 API, 워크플로 원자 연산

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active;
$$;

create or replace function public.is_editorial()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() in ('EDITOR', 'ADMIN'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_app_role() = 'ADMIN', false);
$$;

create or replace function public.owns_manuscript(target_manuscript_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.manuscripts m
    where m.id = target_manuscript_id and m.created_by = auth.uid()
  );
$$;

create or replace function public.is_assigned_reviewer(target_manuscript_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reviewer_assignments ra
    where ra.manuscript_id = target_manuscript_id
      and ra.reviewer_id = auth.uid()
      and ra.status in ('INVITED', 'ACCEPTED', 'COMPLETED')
  );
$$;

create or replace function public.update_my_profile(
  new_full_name text,
  new_affiliation text default null,
  new_phone text default null,
  new_research_fields text[] default '{}',
  new_reviewer_bio text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(new_full_name, ''))) = 0 then raise exception 'Full name is required'; end if;

  update public.profiles
  set full_name = trim(new_full_name),
      affiliation = nullif(trim(coalesce(new_affiliation, '')), ''),
      phone = nullif(trim(coalesce(new_phone, '')), ''),
      research_fields = coalesce(new_research_fields, '{}'),
      reviewer_bio = nullif(trim(coalesce(new_reviewer_bio, '')), '')
  where id = auth.uid() and is_active
  returning * into result;

  if result.id is null then raise exception 'Active profile not found'; end if;
  return result;
end;
$$;

create or replace function public.set_user_role(target_user_id uuid, new_role public.app_role)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.profiles;
begin
  if not public.is_admin() then raise exception 'Admin permission required'; end if;
  if target_user_id = auth.uid() and new_role <> 'ADMIN' then
    raise exception 'Administrators cannot demote their own account';
  end if;

  update public.profiles set role = new_role where id = target_user_id returning * into result;
  if result.id is null then raise exception 'Profile not found'; end if;
  return result;
end;
$$;

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
  if not exists (select 1 from public.authors a where a.manuscript_id = target_manuscript_id and a.is_corresponding) then
    raise exception 'A corresponding author is required';
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

create or replace function public.submit_revision(target_manuscript_id uuid)
returns public.manuscripts
language plpgsql
security definer
set search_path = ''
as $$
declare
  manuscript_row public.manuscripts;
  next_round integer;
begin
  select * into manuscript_row from public.manuscripts where id = target_manuscript_id for update;
  if manuscript_row.id is null or manuscript_row.created_by <> auth.uid() then raise exception 'Manuscript not found'; end if;
  if manuscript_row.status <> 'REVISION_REQUESTED' then raise exception 'This manuscript is not awaiting a revision'; end if;
  next_round := manuscript_row.round_no + 1;
  if not exists (
    select 1 from public.manuscript_files f
    where f.manuscript_id = target_manuscript_id and f.file_kind = 'REVISION' and f.version_no = next_round and f.is_anonymized
  ) then raise exception 'An anonymized revision file for the next round is required'; end if;

  update public.manuscripts
  set status = 'REVISION_SUBMITTED', round_no = next_round, current_due_at = null
  where id = target_manuscript_id
  returning * into manuscript_row;
  return manuscript_row;
end;
$$;

create or replace function public.assign_reviewer(
  target_manuscript_id uuid,
  target_reviewer_id uuid,
  review_due_at timestamptz
)
returns public.reviewer_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  manuscript_row public.manuscripts;
  assignment_row public.reviewer_assignments;
  active_count integer;
begin
  if not public.is_editorial() then raise exception 'Editorial permission required'; end if;
  if review_due_at <= now() then raise exception 'Review due date must be in the future'; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = target_reviewer_id and p.role = 'REVIEWER' and p.is_active
  ) then raise exception 'Active reviewer not found'; end if;

  select * into manuscript_row from public.manuscripts where id = target_manuscript_id for update;
  if manuscript_row.id is null then raise exception 'Manuscript not found'; end if;
  if manuscript_row.status not in ('FORMAT_REVIEW', 'REVIEWER_SELECTION', 'REVISION_SUBMITTED', 'RE_REVIEW') then
    raise exception 'Reviewer assignment is not allowed in the current status';
  end if;

  select count(*) into active_count
  from public.reviewer_assignments ra
  where ra.manuscript_id = target_manuscript_id
    and ra.round_no = greatest(manuscript_row.round_no, 1)
    and ra.status not in ('DECLINED', 'CANCELLED');
  if active_count >= 2 then raise exception 'Two active reviewers are already assigned for this round'; end if;

  insert into public.reviewer_assignments (manuscript_id, reviewer_id, assigned_by, round_no, due_at)
  values (target_manuscript_id, target_reviewer_id, auth.uid(), greatest(manuscript_row.round_no, 1), review_due_at)
  returning * into assignment_row;

  update public.manuscripts
  set status = case when manuscript_row.round_no > 1 then 'RE_REVIEW'::public.manuscript_status else 'REVIEWER_SELECTION'::public.manuscript_status end,
      current_due_at = greatest(coalesce(current_due_at, review_due_at), review_due_at)
  where id = target_manuscript_id;

  return assignment_row;
end;
$$;

create or replace function public.respond_to_review_assignment(
  target_assignment_id uuid,
  accept_assignment boolean,
  response_reason text default null
)
returns public.reviewer_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  assignment_row public.reviewer_assignments;
  accepted_count integer;
  target_round integer;
begin
  select * into assignment_row
  from public.reviewer_assignments
  where id = target_assignment_id and reviewer_id = auth.uid()
  for update;
  if assignment_row.id is null then raise exception 'Assignment not found'; end if;
  if assignment_row.status <> 'INVITED' then raise exception 'Assignment has already been answered'; end if;

  update public.reviewer_assignments
  set status = case when accept_assignment then 'ACCEPTED'::public.assignment_status else 'DECLINED'::public.assignment_status end,
      responded_at = now(),
      decline_reason = case when accept_assignment then null else nullif(trim(coalesce(response_reason, '')), '') end
  where id = target_assignment_id
  returning * into assignment_row;

  if accept_assignment then
    select count(*) into accepted_count
    from public.reviewer_assignments ra
    where ra.manuscript_id = assignment_row.manuscript_id
      and ra.round_no = assignment_row.round_no
      and ra.status in ('ACCEPTED', 'COMPLETED');
    select round_no into target_round from public.manuscripts where id = assignment_row.manuscript_id;
    if accepted_count >= 2 then
      update public.manuscripts
      set status = case when target_round > 1 then 'RE_REVIEW'::public.manuscript_status else 'UNDER_REVIEW'::public.manuscript_status end
      where id = assignment_row.manuscript_id;
    end if;
  end if;
  return assignment_row;
end;
$$;

create or replace function public.save_review_draft(
  target_assignment_id uuid,
  draft_recommendation public.review_recommendation default null,
  draft_author_comments text default '',
  draft_editor_comments text default ''
)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  review_row public.reviews;
begin
  if not exists (
    select 1 from public.reviewer_assignments ra
    where ra.id = target_assignment_id and ra.reviewer_id = auth.uid() and ra.status = 'ACCEPTED'
  ) then raise exception 'Accepted assignment not found'; end if;

  insert into public.reviews (assignment_id, recommendation, author_comments, editor_comments, status)
  values (target_assignment_id, draft_recommendation, coalesce(draft_author_comments, ''), coalesce(draft_editor_comments, ''), 'DRAFT')
  on conflict (assignment_id) do update
    set recommendation = excluded.recommendation,
        author_comments = excluded.author_comments,
        editor_comments = excluded.editor_comments
    where public.reviews.status = 'DRAFT'
  returning * into review_row;
  if review_row.id is null then raise exception 'Submitted reviews cannot be edited'; end if;
  return review_row;
end;
$$;

create or replace function public.submit_review(
  target_assignment_id uuid,
  final_recommendation public.review_recommendation,
  final_author_comments text,
  final_editor_comments text default ''
)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  review_row public.reviews;
begin
  if length(trim(coalesce(final_author_comments, ''))) = 0 then raise exception 'Comments for the author are required'; end if;
  if not exists (
    select 1 from public.reviewer_assignments ra
    where ra.id = target_assignment_id and ra.reviewer_id = auth.uid() and ra.status = 'ACCEPTED'
  ) then raise exception 'Accepted assignment not found'; end if;

  insert into public.reviews (assignment_id, recommendation, author_comments, editor_comments, status, submitted_at)
  values (target_assignment_id, final_recommendation, trim(final_author_comments), coalesce(final_editor_comments, ''), 'SUBMITTED', now())
  on conflict (assignment_id) do update
    set recommendation = excluded.recommendation,
        author_comments = excluded.author_comments,
        editor_comments = excluded.editor_comments,
        status = 'SUBMITTED',
        submitted_at = now()
    where public.reviews.status = 'DRAFT'
  returning * into review_row;
  if review_row.id is null then raise exception 'Review has already been submitted'; end if;

  update public.reviewer_assignments set status = 'COMPLETED' where id = target_assignment_id;
  return review_row;
end;
$$;

create or replace function public.record_editorial_decision(
  target_manuscript_id uuid,
  new_decision public.editorial_decision_type,
  public_author_letter text,
  private_internal_note text default null
)
returns public.editorial_decisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  manuscript_row public.manuscripts;
  decision_row public.editorial_decisions;
  mapped_status public.manuscript_status;
begin
  if not public.is_editorial() then raise exception 'Editorial permission required'; end if;
  if length(trim(coalesce(public_author_letter, ''))) = 0 then raise exception 'Author decision letter is required'; end if;
  select * into manuscript_row from public.manuscripts where id = target_manuscript_id for update;
  if manuscript_row.id is null then raise exception 'Manuscript not found'; end if;

  mapped_status := case new_decision
    when 'REVISION_REQUESTED' then 'REVISION_REQUESTED'
    when 'ACCEPTED' then 'ACCEPTED'
    when 'ACCEPT_WITH_REVISIONS' then 'ACCEPT_WITH_REVISIONS'
    when 'REJECTED' then 'REJECTED'
    when 'FINAL_ACCEPTED' then 'FINAL_ACCEPTED'
  end;

  if new_decision = 'FINAL_ACCEPTED' and not exists (
    select 1 from public.manuscript_files f
    where f.manuscript_id = target_manuscript_id and f.file_kind = 'FINAL'
  ) then raise exception 'A final manuscript file is required before final acceptance'; end if;

  insert into public.editorial_decisions (manuscript_id, round_no, decision, author_letter, internal_note, decided_by)
  values (target_manuscript_id, manuscript_row.round_no, new_decision, trim(public_author_letter), nullif(trim(coalesce(private_internal_note, '')), ''), auth.uid())
  returning * into decision_row;

  update public.manuscripts set status = mapped_status, current_due_at = null where id = target_manuscript_id;
  update public.manuscript_status_history
  set note = trim(public_author_letter)
  where id = (
    select h.id from public.manuscript_status_history h
    where h.manuscript_id = target_manuscript_id and h.to_status = mapped_status
    order by h.id desc limit 1
  );
  return decision_row;
end;
$$;

create or replace function public.advance_manuscript_status(
  target_manuscript_id uuid,
  next_status public.manuscript_status,
  change_note text default null
)
returns public.manuscripts
language plpgsql
security definer
set search_path = ''
as $$
declare
  manuscript_row public.manuscripts;
  allowed boolean := false;
begin
  if not public.is_editorial() then raise exception 'Editorial permission required'; end if;
  select * into manuscript_row from public.manuscripts where id = target_manuscript_id for update;
  if manuscript_row.id is null then raise exception 'Manuscript not found'; end if;

  allowed := (manuscript_row.status, next_status) in (
    ('SUBMITTED'::public.manuscript_status, 'RECEIVED'::public.manuscript_status),
    ('RECEIVED'::public.manuscript_status, 'FORMAT_REVIEW'::public.manuscript_status),
    ('FORMAT_REVIEW'::public.manuscript_status, 'REVIEWER_SELECTION'::public.manuscript_status),
    ('REVISION_SUBMITTED'::public.manuscript_status, 'RE_REVIEW'::public.manuscript_status),
    ('ACCEPTED'::public.manuscript_status, 'FINAL_ACCEPTED'::public.manuscript_status),
    ('ACCEPT_WITH_REVISIONS'::public.manuscript_status, 'FINAL_ACCEPTED'::public.manuscript_status),
    ('FINAL_ACCEPTED'::public.manuscript_status, 'PUBLISHED'::public.manuscript_status)
  );
  if not allowed then raise exception 'Invalid manuscript status transition'; end if;
  if next_status = 'FINAL_ACCEPTED' and not exists (
    select 1 from public.manuscript_files f where f.manuscript_id = target_manuscript_id and f.file_kind = 'FINAL'
  ) then raise exception 'A final manuscript file is required'; end if;
  if next_status = 'PUBLISHED' and not exists (
    select 1 from public.published_articles pa where pa.manuscript_id = target_manuscript_id
  ) then raise exception 'Published article metadata is required'; end if;

  update public.manuscripts set status = next_status where id = target_manuscript_id returning * into manuscript_row;
  update public.manuscript_status_history
  set note = nullif(trim(coalesce(change_note, '')), '')
  where id = (
    select h.id from public.manuscript_status_history h
    where h.manuscript_id = target_manuscript_id and h.to_status = next_status
    order by h.id desc limit 1
  );
  return manuscript_row;
end;
$$;

create or replace function public.get_reviewer_manuscripts()
returns table (
  assignment_id uuid,
  manuscript_id uuid,
  manuscript_code text,
  title_ko text,
  title_en text,
  abstract_ko text,
  abstract_en text,
  keywords_ko text[],
  keywords_en text[],
  research_field text,
  manuscript_status public.manuscript_status,
  assignment_status public.assignment_status,
  round_no integer,
  due_at timestamptz,
  responded_at timestamptz,
  review_status public.review_status,
  recommendation public.review_recommendation,
  review_submitted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ra.id, m.id, m.manuscript_code, m.title_ko, m.title_en,
    m.abstract_ko, m.abstract_en, m.keywords_ko, m.keywords_en,
    m.research_field, m.status, ra.status, ra.round_no, ra.due_at,
    ra.responded_at, r.status, r.recommendation, r.submitted_at
  from public.reviewer_assignments ra
  join public.manuscripts m on m.id = ra.manuscript_id
  left join public.reviews r on r.assignment_id = ra.id
  where ra.reviewer_id = auth.uid()
    and public.current_app_role() = 'REVIEWER'
  order by (ra.status = 'INVITED') desc, ra.due_at asc;
$$;

create or replace function public.get_reviewer_files(target_manuscript_id uuid)
returns table (
  file_id uuid,
  bucket_id text,
  storage_path text,
  file_kind public.manuscript_file_kind,
  version_no integer,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.bucket_id, f.storage_path, f.file_kind, f.version_no, f.mime_type, f.size_bytes, f.created_at
  from public.manuscript_files f
  where f.manuscript_id = target_manuscript_id
    and f.file_kind in ('ANONYMIZED', 'REVISION')
    and f.is_anonymized
    and public.is_assigned_reviewer(target_manuscript_id)
  order by f.version_no desc, f.created_at desc;
$$;

create or replace function public.get_author_decisions(target_manuscript_id uuid)
returns table (
  decision public.editorial_decision_type,
  author_letter text,
  round_no integer,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.decision, d.author_letter, d.round_no, d.decided_at
  from public.editorial_decisions d
  where d.manuscript_id = target_manuscript_id
    and public.owns_manuscript(target_manuscript_id)
  order by d.decided_at desc;
$$;

create or replace function public.get_author_status_history(target_manuscript_id uuid)
returns table (
  from_status public.manuscript_status,
  to_status public.manuscript_status,
  note text,
  changed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select h.from_status, h.to_status, h.note, h.changed_at
  from public.manuscript_status_history h
  where h.manuscript_id = target_manuscript_id
    and public.owns_manuscript(target_manuscript_id)
  order by h.changed_at desc;
$$;

alter table public.profiles enable row level security;
alter table public.profile_role_history enable row level security;
alter table public.manuscript_counters enable row level security;
alter table public.manuscripts enable row level security;
alter table public.authors enable row level security;
alter table public.manuscript_files enable row level security;
alter table public.reviewer_assignments enable row level security;
alter table public.reviews enable row level security;
alter table public.editorial_decisions enable row level security;
alter table public.manuscript_status_history enable row level security;
alter table public.issues enable row level security;
alter table public.published_articles enable row level security;

create policy profiles_select_self_or_editorial on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_editorial());

create policy role_history_admin_only on public.profile_role_history
for select to authenticated using (public.is_admin());

create policy manuscripts_select_owner_or_editorial on public.manuscripts
for select to authenticated
using (created_by = auth.uid() or public.is_editorial());
create policy manuscripts_insert_author_draft on public.manuscripts
for insert to authenticated
with check (created_by = auth.uid() and status = 'DRAFT' and public.current_app_role() = 'AUTHOR');
create policy manuscripts_update_own_draft on public.manuscripts
for update to authenticated
using (created_by = auth.uid() and status = 'DRAFT' and public.current_app_role() = 'AUTHOR')
with check (created_by = auth.uid() and status = 'DRAFT');

create policy authors_select_owner_or_editorial on public.authors
for select to authenticated
using (public.owns_manuscript(manuscript_id) or public.is_editorial());
create policy authors_insert_own_draft on public.authors
for insert to authenticated
with check (
  public.owns_manuscript(manuscript_id)
  and exists (select 1 from public.manuscripts m where m.id = manuscript_id and m.status = 'DRAFT')
);
create policy authors_update_own_draft on public.authors
for update to authenticated
using (public.owns_manuscript(manuscript_id) and exists (select 1 from public.manuscripts m where m.id = manuscript_id and m.status = 'DRAFT'))
with check (public.owns_manuscript(manuscript_id));
create policy authors_delete_own_draft on public.authors
for delete to authenticated
using (public.owns_manuscript(manuscript_id) and exists (select 1 from public.manuscripts m where m.id = manuscript_id and m.status = 'DRAFT'));

create policy files_select_author_editor_or_uploader on public.manuscript_files
for select to authenticated
using (
  public.is_editorial()
  or uploaded_by = auth.uid()
  or (public.owns_manuscript(manuscript_id) and file_kind <> 'REVIEW_ATTACHMENT')
);
create policy files_insert_author_reviewer_or_editor on public.manuscript_files
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    public.is_editorial()
    or (
      public.owns_manuscript(manuscript_id)
      and file_kind in ('ORIGINAL', 'ANONYMIZED', 'REVISION', 'FINAL')
      and bucket_id in ('manuscripts', 'revisions', 'final-files')
    )
    or (
      public.current_app_role() = 'REVIEWER'
      and public.is_assigned_reviewer(manuscript_id)
      and file_kind = 'REVIEW_ATTACHMENT'
      and bucket_id = 'review-files'
    )
  )
);

create policy assignments_select_reviewer_or_editorial on public.reviewer_assignments
for select to authenticated
using (reviewer_id = auth.uid() or public.is_editorial());

create policy reviews_select_reviewer_or_editorial on public.reviews
for select to authenticated
using (
  public.is_editorial()
  or exists (
    select 1 from public.reviewer_assignments ra
    where ra.id = assignment_id and ra.reviewer_id = auth.uid()
  )
);

create policy decisions_editorial_only on public.editorial_decisions
for select to authenticated using (public.is_editorial());
create policy status_history_editorial_only on public.manuscript_status_history
for select to authenticated using (public.is_editorial());

create policy issues_public_or_admin_read on public.issues
for select to anon, authenticated
using (status = 'PUBLISHED' or public.is_admin());
create policy issues_admin_insert on public.issues
for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy issues_admin_update on public.issues
for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy published_articles_public_read on public.published_articles
for select to anon, authenticated
using (exists (select 1 from public.issues i where i.id = issue_id and i.status = 'PUBLISHED') or public.is_admin());
create policy published_articles_admin_insert on public.published_articles
for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy published_articles_admin_update on public.published_articles
for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert on public.manuscripts to authenticated;
grant update (title_ko, title_en, abstract_ko, abstract_en, keywords_ko, keywords_en, research_field, ethics_confirmed, conflict_of_interest_confirmed, copyright_agreed) on public.manuscripts to authenticated;
grant select, insert, delete on public.authors to authenticated;
grant update (name_ko, name_en, affiliation_ko, affiliation_en, email, is_corresponding, sort_order) on public.authors to authenticated;
grant select, insert on public.manuscript_files to authenticated;
grant select on public.reviewer_assignments, public.reviews, public.editorial_decisions, public.manuscript_status_history to authenticated;
grant select on public.profile_role_history to authenticated;
grant select, insert, update on public.issues, public.published_articles to authenticated;
grant select on public.issues, public.published_articles to anon;

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.record_manuscript_status_history() from public, anon, authenticated;
revoke execute on function public.record_profile_role_history() from public, anon, authenticated;
revoke execute on function public.current_app_role() from public, anon;
revoke execute on function public.is_editorial() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.owns_manuscript(uuid) from public, anon;
revoke execute on function public.is_assigned_reviewer(uuid) from public, anon;
revoke execute on function public.update_my_profile(text, text, text, text[], text) from public, anon;
revoke execute on function public.set_user_role(uuid, public.app_role) from public, anon;
revoke execute on function public.submit_manuscript(uuid) from public, anon;
revoke execute on function public.submit_revision(uuid) from public, anon;
revoke execute on function public.assign_reviewer(uuid, uuid, timestamptz) from public, anon;
revoke execute on function public.respond_to_review_assignment(uuid, boolean, text) from public, anon;
revoke execute on function public.save_review_draft(uuid, public.review_recommendation, text, text) from public, anon;
revoke execute on function public.submit_review(uuid, public.review_recommendation, text, text) from public, anon;
revoke execute on function public.record_editorial_decision(uuid, public.editorial_decision_type, text, text) from public, anon;
revoke execute on function public.advance_manuscript_status(uuid, public.manuscript_status, text) from public, anon;
revoke execute on function public.get_reviewer_manuscripts() from public, anon;
revoke execute on function public.get_reviewer_files(uuid) from public, anon;
revoke execute on function public.get_author_decisions(uuid) from public, anon;
revoke execute on function public.get_author_status_history(uuid) from public, anon;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_editorial() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_manuscript(uuid) to authenticated;
grant execute on function public.is_assigned_reviewer(uuid) to authenticated;
grant execute on function public.update_my_profile(text, text, text, text[], text) to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
grant execute on function public.submit_manuscript(uuid) to authenticated;
grant execute on function public.submit_revision(uuid) to authenticated;
grant execute on function public.assign_reviewer(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.respond_to_review_assignment(uuid, boolean, text) to authenticated;
grant execute on function public.save_review_draft(uuid, public.review_recommendation, text, text) to authenticated;
grant execute on function public.submit_review(uuid, public.review_recommendation, text, text) to authenticated;
grant execute on function public.record_editorial_decision(uuid, public.editorial_decision_type, text, text) to authenticated;
grant execute on function public.advance_manuscript_status(uuid, public.manuscript_status, text) to authenticated;
grant execute on function public.get_reviewer_manuscripts() to authenticated;
grant execute on function public.get_reviewer_files(uuid) to authenticated;
grant execute on function public.get_author_decisions(uuid) to authenticated;
grant execute on function public.get_author_status_history(uuid) to authenticated;
