-- 한 계정이 투고자·심사위원·편집위원·관리자 역할을 동시에 가질 수 있도록 확장한다.
-- profiles.role은 기존 코드 호환을 위한 최상위 역할로 유지하고 profile_roles를 권한의 기준으로 사용한다.

create table public.profile_roles (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (profile_id, role)
);

create index profile_roles_role_idx on public.profile_roles(role, profile_id);

-- 승인 사용자는 모두 투고자이며 기존 단일 역할도 그대로 보존한다.
insert into public.profile_roles (profile_id, role)
select id, 'AUTHOR'::public.app_role from public.profiles
on conflict do nothing;

insert into public.profile_roles (profile_id, role)
select id, role from public.profiles where role <> 'AUTHOR'
on conflict do nothing;

create or replace function public.ensure_default_author_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile_roles (profile_id, role)
  values (new.id, 'AUTHOR')
  on conflict do nothing;
  return new;
end;
$$;

create trigger profiles_ensure_default_author_role
after insert on public.profiles
for each row execute function public.ensure_default_author_role();

create or replace function public.has_app_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_roles pr
    join public.profiles p on p.id = pr.profile_id
    where pr.profile_id = auth.uid()
      and pr.role = required_role
      and p.is_active
  );
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select pr.role
  from public.profile_roles pr
  join public.profiles p on p.id = pr.profile_id
  where pr.profile_id = auth.uid() and p.is_active
  order by case pr.role
    when 'ADMIN' then 4
    when 'EDITOR' then 3
    when 'REVIEWER' then 2
    else 1
  end desc
  limit 1;
$$;

create or replace function public.is_editorial()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_app_role('EDITOR') or public.has_app_role('ADMIN');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_app_role('ADMIN');
$$;

create or replace function public.is_assigned_reviewer(target_manuscript_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_app_role('REVIEWER') and exists (
    select 1
    from public.reviewer_assignments ra
    where ra.manuscript_id = target_manuscript_id
      and ra.reviewer_id = auth.uid()
      and ra.status in ('INVITED', 'ACCEPTED', 'COMPLETED')
  );
$$;

create or replace function public.get_my_roles()
returns public.app_role[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(pr.role order by case pr.role
    when 'AUTHOR' then 1
    when 'REVIEWER' then 2
    when 'EDITOR' then 3
    when 'ADMIN' then 4
  end), '{}'::public.app_role[])
  from public.profile_roles pr
  join public.profiles p on p.id = pr.profile_id
  where pr.profile_id = auth.uid() and p.is_active;
$$;

create or replace function public.set_user_roles(
  target_user_id uuid,
  new_roles public.app_role[]
)
returns public.app_role[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_roles public.app_role[];
  primary_role public.app_role;
begin
  if not public.is_admin() then raise exception 'Admin permission required'; end if;
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception 'Profile not found';
  end if;

  select coalesce(array_agg(distinct requested_role), '{}'::public.app_role[])
    into normalized_roles
  from unnest(coalesce(new_roles, '{}'::public.app_role[])) requested_role;

  if not ('AUTHOR'::public.app_role = any(normalized_roles)) then
    normalized_roles := array_append(normalized_roles, 'AUTHOR'::public.app_role);
  end if;
  if target_user_id = auth.uid() and not ('ADMIN'::public.app_role = any(normalized_roles)) then
    raise exception 'Administrators cannot remove their own admin role';
  end if;

  delete from public.profile_roles pr
  where pr.profile_id = target_user_id
    and not (pr.role = any(normalized_roles));

  insert into public.profile_roles (profile_id, role, granted_by)
  select target_user_id, requested_role, auth.uid()
  from unnest(normalized_roles) requested_role
  on conflict (profile_id, role) do nothing;

  select pr.role into primary_role
  from public.profile_roles pr
  where pr.profile_id = target_user_id
  order by case pr.role
    when 'ADMIN' then 4
    when 'EDITOR' then 3
    when 'REVIEWER' then 2
    else 1
  end desc
  limit 1;

  update public.profiles set role = primary_role where id = target_user_id;

  return (
    select array_agg(pr.role order by case pr.role
      when 'AUTHOR' then 1
      when 'REVIEWER' then 2
      when 'EDITOR' then 3
      when 'ADMIN' then 4
    end)
    from public.profile_roles pr
    where pr.profile_id = target_user_id
  );
end;
$$;

-- 기존 단일 역할 API도 안전하게 유지한다.
create or replace function public.set_user_role(target_user_id uuid, new_role public.app_role)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.profiles;
begin
  perform public.set_user_roles(target_user_id, array['AUTHOR'::public.app_role, new_role]);
  select * into result from public.profiles where id = target_user_id;
  return result;
end;
$$;

alter table public.profile_roles enable row level security;

create policy profile_roles_select_self_or_editorial on public.profile_roles
for select to authenticated
using (profile_id = auth.uid() or public.is_editorial());

revoke all on public.profile_roles from anon, authenticated;
grant select on public.profile_roles to authenticated;

drop policy manuscripts_insert_author_draft on public.manuscripts;
create policy manuscripts_insert_author_draft on public.manuscripts
for insert to authenticated
with check (created_by = auth.uid() and status = 'DRAFT' and public.has_app_role('AUTHOR'));

drop policy manuscripts_update_own_draft on public.manuscripts;
create policy manuscripts_update_own_draft on public.manuscripts
for update to authenticated
using (created_by = auth.uid() and status = 'DRAFT' and public.has_app_role('AUTHOR'))
with check (created_by = auth.uid() and status = 'DRAFT');

drop policy files_insert_author_reviewer_or_editor on public.manuscript_files;
create policy files_insert_author_reviewer_or_editor on public.manuscript_files
for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    (
      public.is_editorial()
      and (file_kind <> 'PUBLISHED' or public.is_admin())
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
      public.has_app_role('REVIEWER')
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

drop policy assignments_select_reviewer_or_editorial on public.reviewer_assignments;
create policy assignments_select_reviewer_or_editorial on public.reviewer_assignments
for select to authenticated
using (
  public.is_editorial()
  or (reviewer_id = auth.uid() and public.has_app_role('REVIEWER'))
);

drop policy reviews_select_reviewer_or_editorial on public.reviews;
create policy reviews_select_reviewer_or_editorial on public.reviews
for select to authenticated
using (
  public.is_editorial()
  or (
    public.has_app_role('REVIEWER')
    and exists (
      select 1 from public.reviewer_assignments ra
      where ra.id = assignment_id and ra.reviewer_id = auth.uid()
    )
  )
);

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
    select 1
    from public.profiles p
    join public.profile_roles pr on pr.profile_id = p.id and pr.role = 'REVIEWER'
    where p.id = target_reviewer_id and p.is_active
  ) then raise exception 'Active reviewer not found'; end if;
  if exists (
    select 1 from public.authors a
    where a.manuscript_id = target_manuscript_id and a.user_id = target_reviewer_id
  ) then raise exception 'Authors cannot review their own manuscript'; end if;

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
  if active_count >= 3 then raise exception 'Three active reviewers are already assigned for this round'; end if;

  insert into public.reviewer_assignments (manuscript_id, reviewer_id, assigned_by, round_no, due_at)
  values (target_manuscript_id, target_reviewer_id, auth.uid(), greatest(manuscript_row.round_no, 1), review_due_at)
  returning * into assignment_row;

  update public.manuscripts
  set status = case
        when manuscript_row.round_no > 1 then 'RE_REVIEW'::public.manuscript_status
        else 'REVIEWER_SELECTION'::public.manuscript_status
      end,
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
  if not public.has_app_role('REVIEWER') then raise exception 'Reviewer permission required'; end if;
  select * into assignment_row
  from public.reviewer_assignments
  where id = target_assignment_id and reviewer_id = auth.uid()
  for update;
  if assignment_row.id is null then raise exception 'Assignment not found'; end if;
  if assignment_row.status <> 'INVITED' then raise exception 'Assignment has already been answered'; end if;

  update public.reviewer_assignments
  set status = case
        when accept_assignment then 'ACCEPTED'::public.assignment_status
        else 'DECLINED'::public.assignment_status
      end,
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
    if accepted_count >= 3 then
      update public.manuscripts
      set status = case
        when target_round > 1 then 'RE_REVIEW'::public.manuscript_status
        else 'UNDER_REVIEW'::public.manuscript_status
      end
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
  if not public.has_app_role('REVIEWER') then raise exception 'Reviewer permission required'; end if;
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
  if not public.has_app_role('REVIEWER') then raise exception 'Reviewer permission required'; end if;
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
    and public.has_app_role('REVIEWER')
  order by (ra.status = 'INVITED') desc, ra.due_at asc;
$$;

revoke execute on function public.ensure_default_author_role() from public, anon, authenticated;
revoke execute on function public.has_app_role(public.app_role) from public, anon;
revoke execute on function public.get_my_roles() from public, anon;
revoke execute on function public.set_user_roles(uuid, public.app_role[]) from public, anon;
grant execute on function public.has_app_role(public.app_role) to authenticated;
grant execute on function public.get_my_roles() to authenticated;
grant execute on function public.set_user_roles(uuid, public.app_role[]) to authenticated;

comment on table public.profile_roles is '한 계정에 중복 부여되는 투고자·심사위원·편집위원·관리자 역할';
comment on function public.set_user_roles(uuid, public.app_role[]) is '관리자가 기본 AUTHOR를 포함한 복수 역할을 원자적으로 부여';
