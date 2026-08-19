-- 운영 프로젝트에서 누락된 저자용 심사결과 조회 RPC를 복구한다.
-- 심사위원 식별정보와 편집위원 전용 의견은 반환하지 않는다.

create or replace function public.get_author_review_results(target_manuscript_id uuid)
returns table (
  reviewer_no integer,
  round_no integer,
  recommendation public.review_recommendation,
  author_comments text,
  submitted_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    row_number() over (
      partition by ra.round_no
      order by r.submitted_at, r.id
    )::integer as reviewer_no,
    ra.round_no,
    r.recommendation,
    r.author_comments,
    r.submitted_at
  from public.reviews r
  join public.reviewer_assignments ra on ra.id = r.assignment_id
  where ra.manuscript_id = target_manuscript_id
    and r.status = 'SUBMITTED'
    and r.recommendation is not null
    and r.submitted_at is not null
    and public.owns_manuscript(target_manuscript_id)
  order by ra.round_no desc, reviewer_no;
$$;

revoke execute on function public.get_author_review_results(uuid) from public, anon;
grant execute on function public.get_author_review_results(uuid) to authenticated;

comment on function public.get_author_review_results(uuid) is
  '논문 소유 저자에게 심사위원 식별정보와 편집위원 전용 의견을 제외한 제출 심사의견만 반환';
