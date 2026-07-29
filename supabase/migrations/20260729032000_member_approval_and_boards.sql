-- 관리자 회원가입 승인과 공지사항·학회행사 게시판

alter table public.profiles
  alter column is_active set default false,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null;

update public.profiles
set approved_at = coalesce(approved_at, created_at)
where is_active and approved_at is null;

create table public.profile_approval_history (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('APPROVED', 'SUSPENDED')),
  changed_by uuid not null references public.profiles(id) on delete restrict,
  note text,
  changed_at timestamptz not null default now()
);

create index profile_approval_history_profile_idx
  on public.profile_approval_history(profile_id, changed_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'AUTHOR',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.set_user_activation(
  target_user_id uuid,
  make_active boolean,
  change_note text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.profiles;
begin
  if not public.is_admin() then raise exception 'Admin permission required'; end if;
  if target_user_id = auth.uid() and not make_active then
    raise exception 'Administrators cannot suspend their own account';
  end if;

  update public.profiles
  set is_active = make_active,
      approved_at = case when make_active then now() else null end,
      approved_by = case when make_active then auth.uid() else null end
  where id = target_user_id
  returning * into result;

  if result.id is null then raise exception 'Profile not found'; end if;

  insert into public.profile_approval_history (profile_id, action, changed_by, note)
  values (
    target_user_id,
    case when make_active then 'APPROVED' else 'SUSPENDED' end,
    auth.uid(),
    nullif(trim(coalesce(change_note, '')), '')
  );

  return result;
end;
$$;

create table public.board_posts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('NOTICE', 'EVENT')),
  title text not null check (length(trim(title)) > 0),
  content text not null check (length(trim(content)) > 0),
  event_start_at timestamptz,
  event_end_at timestamptz,
  location text,
  is_pinned boolean not null default false,
  is_published boolean not null default false,
  published_at timestamptz,
  author_id uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint board_event_dates check (
    category = 'NOTICE'
    or (event_start_at is not null and (event_end_at is null or event_end_at >= event_start_at))
  ),
  constraint board_publish_date check (not is_published or published_at is not null)
);

create index board_posts_public_idx
  on public.board_posts(category, is_published, is_pinned desc, published_at desc);

create trigger board_posts_set_updated_at before update on public.board_posts
for each row execute function public.set_updated_at();

alter table public.profile_approval_history enable row level security;
alter table public.board_posts enable row level security;

create policy approval_history_admin_only on public.profile_approval_history
for select to authenticated using (public.is_admin());

create policy board_posts_public_read on public.board_posts
for select to anon, authenticated
using (is_published or public.is_admin());

create policy board_posts_admin_insert on public.board_posts
for insert to authenticated
with check (public.is_admin() and author_id = auth.uid());

create policy board_posts_admin_update on public.board_posts
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy board_posts_admin_delete on public.board_posts
for delete to authenticated using (public.is_admin());

revoke all on public.profile_approval_history, public.board_posts from anon, authenticated;
grant select on public.profile_approval_history to authenticated;
grant select on public.board_posts to anon, authenticated;
grant insert, update, delete on public.board_posts to authenticated;

revoke execute on function public.set_user_activation(uuid, boolean, text) from public, anon;
grant execute on function public.set_user_activation(uuid, boolean, text) to authenticated;

insert into public.board_posts (category, title, content, is_pinned, is_published, published_at, author_id)
select 'NOTICE', '온라인 논문투고·심사 시스템 이용 안내',
       '저자, 심사위원, 편집위원은 로그인 후 역할별 업무를 이용할 수 있습니다. 신규 회원은 이메일 인증 후 관리자 승인을 받아야 합니다.',
       true, true, now(), null
where not exists (
  select 1 from public.board_posts where category = 'NOTICE' and title = '온라인 논문투고·심사 시스템 이용 안내'
);

insert into public.board_posts (category, title, content, is_pinned, is_published, published_at, author_id)
select 'NOTICE', '연구윤리 및 이중맹검 심사 원칙 안내',
       '한국 디지털 건강체력학회지는 저자와 심사위원의 신원을 서로 공개하지 않는 이중맹검 심사를 원칙으로 합니다.',
       false, true, now(), null
where not exists (
  select 1 from public.board_posts where category = 'NOTICE' and title = '연구윤리 및 이중맹검 심사 원칙 안내'
);
