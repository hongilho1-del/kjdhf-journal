-- 연구소 발행 학술지의 공식 명칭으로 기본 안내문을 정정한다.
update public.board_posts
set content = replace(
  content,
  '한국 디지털 건강체력학회지',
  '한국디지털건강체력연구'
),
updated_at = now()
where content like '%한국 디지털 건강체력학회지%';
