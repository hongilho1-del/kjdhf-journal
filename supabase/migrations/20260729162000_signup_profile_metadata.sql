-- 단계형 회원가입에서 받은 기본 프로필을 승인대기 계정에 함께 저장합니다.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  submitted_research_fields text[] := '{}';
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

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

comment on function public.handle_new_user() is
  '신규 Auth 계정의 회원정보를 AUTHOR 승인대기 프로필로 안전하게 생성';
