-- 공개 게시물 조회와 관리자 비공개 게시물 조회를 분리한다.
-- anon 역할이 권한 없는 is_admin()을 평가하지 않도록 정책을 나눈다.

drop policy if exists board_posts_public_read on public.board_posts;
drop policy if exists board_posts_admin_read on public.board_posts;

create policy board_posts_public_read on public.board_posts
for select to anon, authenticated
using (is_published);

create policy board_posts_admin_read on public.board_posts
for select to authenticated
using (public.is_admin());
