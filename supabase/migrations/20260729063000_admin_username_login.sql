-- 관리자 이메일을 노출하지 않는 별도 사용자명 로그인 매핑

create table public.admin_login_aliases (
  username text primary key,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_login_alias_username_format check (
    username = lower(username)
    and username ~ '^[a-z][a-z0-9._-]{2,31}$'
  )
);

create trigger admin_login_aliases_set_updated_at before update on public.admin_login_aliases
for each row execute function public.set_updated_at();

alter table public.admin_login_aliases enable row level security;

-- 별칭은 서비스 전용 로그인 함수에서만 조회하며 브라우저에는 공개하지 않는다.
revoke all on public.admin_login_aliases from anon, authenticated;

create or replace function public.set_admin_login_alias(
  target_user_id uuid,
  login_username text
)
returns public.admin_login_aliases
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_username text := lower(trim(coalesce(login_username, '')));
  result public.admin_login_aliases;
begin
  if not public.is_admin() then raise exception 'Admin permission required'; end if;
  if normalized_username !~ '^[a-z][a-z0-9._-]{2,31}$' then
    raise exception 'Username must be 3-32 lowercase letters, numbers, dot, underscore, or hyphen';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = target_user_id and p.role = 'ADMIN' and p.is_active
  ) then raise exception 'Active administrator not found'; end if;
  if exists (
    select 1 from public.admin_login_aliases a
    where a.username = normalized_username and a.user_id <> target_user_id
  ) then raise exception 'Username is already in use'; end if;

  delete from public.admin_login_aliases
  where user_id = target_user_id and username <> normalized_username;

  insert into public.admin_login_aliases (username, user_id, created_by)
  values (normalized_username, target_user_id, auth.uid())
  on conflict (username) do update
    set user_id = excluded.user_id,
        updated_at = now()
  returning * into result;

  return result;
end;
$$;

revoke execute on function public.set_admin_login_alias(uuid, text) from public, anon;
grant execute on function public.set_admin_login_alias(uuid, text) to authenticated;

comment on table public.admin_login_aliases is '관리자 사용자명과 Supabase Auth 계정의 비공개 매핑';
