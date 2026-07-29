-- 투고 철회를 논문 워크플로의 독립적인 종결 상태로 추가한다.
-- PostgreSQL enum 신규 값은 다음 migration부터 안전하게 사용할 수 있도록 분리한다.

alter type public.manuscript_status add value if not exists 'WITHDRAWN' after 'REJECTED';
