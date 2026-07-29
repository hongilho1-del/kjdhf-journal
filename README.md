# 한국 디지털 건강체력학회지 온라인 논문투고·심사 시스템

한국 디지털 건강체력학회지의 창간·초기 운영을 위한 실제 데이터 기반 투고·이중맹검 심사 시스템입니다. 기존 홈페이지의 녹색 계열 디자인과 JAMS에 가까운 업무 흐름을 유지하면서, 프론트엔드는 정적 배포 가능한 Next.js/Vinext, 인증·데이터·파일은 Supabase로 구성했습니다.

## 시스템 구조

```text
GitHub Pages / Vinext
└─ Next.js 정적 프론트엔드
   ├─ AUTHOR 대시보드: 투고, 수정본·최종본 제출, 결과 확인
   ├─ REVIEWER 대시보드: 의뢰 수락·거절, 익명 원고, 심사의견 제출
   └─ EDITOR / ADMIN 대시보드: 접수, 배정, 판정, 발행 관리
              │ Supabase publishable key + 사용자 JWT
              ▼
Supabase
├─ Authentication: 이메일 회원가입·로그인
├─ PostgreSQL: 업무 데이터, RPC, RLS, 감사 이력
├─ Storage: 원고·수정본·심사자료·최종본·발행본
└─ Edge Function `file-access`: 권한 확인 후 업로드·서명 URL 발급
```

브라우저에는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 전달합니다. `service_role`, 데이터베이스 비밀번호, Supabase access token은 저장소와 프론트엔드에 두지 않습니다. 파일 함수의 `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 함수 런타임에 제공하는 서버 전용 환경변수만 사용합니다.

## 구현 범위

- 신규 회원가입 시 승인대기 `AUTHOR` 프로필 자동 생성, ADMIN의 가입 승인·이용중지
- `AUTHOR`, `REVIEWER`, `EDITOR`, `ADMIN` 역할과 관리자 전용 역할 변경 RPC
- 작성중부터 발행완료까지 14단계 상태와 모든 변경 이력 기록
- `KJDHF-연도-일련번호` 형식의 원고번호 원자적 발급
- 교신저자·공동저자, 한·영 제목/초록/키워드, 연구분야, 윤리·이해상충·저작권 동의
- 원고·익명 원고, 수정본, 심사의견서, 최종본, 발행본 파일 관리
- 원고당 심사위원 3명 배정, 수락·거절, 심사기한 관리
- 저자 공개용 의견과 편집위원 전용 의견 분리
- 편집판정, 발행호 생성, 최종 게재처리와 논문 배정
- 역할별 대시보드와 관리자 통계
- JAMS형 온라인 투고 4개 메뉴와 My Page 단계별 논문 관리
- e-Journal 논문 검색·권호 열람과 KCI 논문 유사도 서비스 연결
- 새 창에서 익명 심사의견·편집결정을 확인하고 수정원고 제출
- 관리자 전용 공지사항·학회행사 작성, 수정, 공개 관리
- 핵심 테이블 RLS, 보안 RPC, 역할·원고 상태 감사 이력

## 데이터베이스

주요 테이블은 다음과 같습니다.

| 테이블 | 용도 |
| --- | --- |
| `profiles` | 사용자 기본정보, 역할, 활성 상태 |
| `profile_role_history` | 역할 변경 감사 이력 |
| `profile_approval_history` | 가입 승인·이용중지 감사 이력 |
| `board_posts` | 공지사항·학회행사 게시물 |
| `manuscripts` | 투고 메타데이터와 현재 상태 |
| `authors` | 교신·공동저자와 순서 |
| `manuscript_files` | Storage 객체의 권한·버전 메타데이터 |
| `reviewer_assignments` | 심사위원 배정, 응답, 기한, 라운드 |
| `reviews` | 판정, 저자용 의견, 편집위원용 의견 |
| `editorial_decisions` | 편집 판정과 저자 통지 내용 |
| `manuscript_status_history` | 이전/신규 상태, 변경자, 변경시각, 사유 |
| `issues` | 권·호와 발행 상태 |
| `published_articles` | 게재확정 논문과 발행호 연결 |

상태값은 `DRAFT → SUBMITTED → RECEIVED → FORMAT_REVIEW → REVIEWER_SELECTION → UNDER_REVIEW → REVISION_REQUESTED → REVISION_SUBMITTED → RE_REVIEW → ACCEPTED/ACCEPT_WITH_REVISIONS/REJECTED → FINAL_ACCEPTED → PUBLISHED`입니다.

마이그레이션은 [supabase/migrations](./supabase/migrations)에 순서대로 저장되어 있습니다.

- `20260728165759_initial_schema.sql`: enum, 테이블, 트리거, 인덱스
- `20260728165805_rls_and_workflow.sql`: RLS, 역할별 정책, 업무 RPC
- `20260728165955_storage_buckets.sql`: 5개 Storage bucket
- `20260728172051_harden_file_metadata_policy.sql`: 파일 메타데이터 정책 강화
- `20260728172253_fix_workflow_enum_casts.sql`: 상태 전이 enum 보강
- `20260729010000_storage_object_policies.sql`: Storage 객체 정책
- `20260729032000_member_approval_and_boards.sql`: 회원 승인과 공지·행사 게시판
- `20260729050000_three_reviewer_workflow.sql`: 논문별 심사위원 3명 배정 규칙
- `20260729063000_admin_username_login.sql`: 관리자 사용자명과 Auth 계정의 비공개 매핑
- `20260729150000_author_review_results.sql`: 저자용 익명 심사결과 조회 RPC
- `20260729162000_signup_profile_metadata.sql`: 단계형 회원가입 기본정보 저장

## 개발환경 실행

요구사항은 Node.js 22.13 이상과 pnpm 11.9입니다.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

`.env.local`에는 현재 연결할 프로젝트의 공개 값만 설정합니다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

환경파일은 `.gitignore` 대상이며 `.env.example`만 커밋합니다. 로컬 접속 주소는 개발 서버 출력에 따릅니다.

## Supabase 설정과 migration

Supabase CLI로 새 환경을 구성할 때 다음 순서로 실행합니다.

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy file-access
supabase functions deploy admin-login --no-verify-jwt
supabase gen types typescript --linked --schema public > lib/supabase/database.types.ts
```

현재 연결 프로젝트 `sjzzbytpyinktxoddmin`에는 스키마·RLS·bucket 마이그레이션과 `file-access` 함수가 반영되어 있습니다. `storage.objects`는 Storage 서비스 소유 테이블이므로, `20260729010000_storage_object_policies.sql`이 일반 migration 계정에서 소유권 오류를 내면 Supabase Dashboard의 SQL Editor 또는 Storage 정책 UI처럼 Storage 정책을 변경할 권한이 있는 경로에서 해당 파일만 적용하고 아래 쿼리로 확인합니다.

```sql
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects';
```

정책을 적용하기 전에도 비공개 bucket은 기본 거부 상태이며, 애플리케이션의 실제 업로드·다운로드는 권한을 재검증하는 `file-access` Edge Function을 통과합니다. 정책 적용 뒤에도 같은 함수를 기본 경로로 유지합니다.

Supabase Dashboard의 **Authentication → URL Configuration**에는 운영 URL과 리다이렉트 URL을 등록합니다.

```text
Site URL: https://OWNER.github.io/REPOSITORY/
Redirect URLs: https://OWNER.github.io/REPOSITORY/**
```

## Storage 구조와 접근 원칙

| Bucket | 공개 여부 | 파일 |
| --- | --- | --- |
| `manuscripts` | 비공개 | 최초 원고, 익명 원고 |
| `revisions` | 비공개 | 수정 원고와 익명 수정본 |
| `review-files` | 비공개 | 심사의견서 첨부 |
| `final-files` | 비공개 | 게재확정 최종본 |
| `published` | 공개 | 발행 승인된 최종 PDF |

객체 경로에는 이메일이나 이름을 사용하지 않고 UUID만 사용합니다. Reviewer용 원고 목록·파일 목록은 작성자 테이블을 직접 열지 않는 보안 RPC가 필요한 필드만 반환합니다. Author는 배정·심사위원 프로필을 조회할 수 없고, Reviewer는 저자·소속·이메일을 조회할 수 없습니다.

## 최초 관리자 계정 생성과 로그인

관리자는 공개 회원가입을 사용하지 않습니다.

1. Supabase Dashboard의 **Authentication → Users → Add user**에서 관리자용 실제 이메일과 초기 비밀번호를 입력하고 이메일을 자동 확인 처리합니다. 이메일은 계정 관리·복구용이며 관리자 로그인 화면에는 입력하지 않습니다.
2. SQL Editor에서 방금 만든 계정을 최초 관리자로 활성화하고 로그인 아이디를 `admin`으로 연결합니다.

```sql
update public.profiles
set role = 'ADMIN',
    is_active = true,
    approved_at = now(),
    approved_by = id
where email = '관리자용 실제 이메일';

insert into public.admin_login_aliases (username, user_id, created_by)
select 'admin', id, id
from public.profiles
where email = '관리자용 실제 이메일';
```

3. 사이트 최상단의 **관리자 로그인**을 눌러 아이디 `admin`과 Add user에서 설정한 비밀번호로 로그인합니다.
4. 관리자 대시보드의 **가입·권한 관리**에서 회원가입을 승인하고 역할을 부여합니다. **공지·행사 관리**에서는 게시물을 등록하거나 편집할 수 있습니다.

일반 사용자는 `profiles.role`을 직접 수정할 권한이 없습니다. 이후 역할 변경은 `ADMIN`만 호출 가능한 `set_user_role` RPC를 거치며 `profile_role_history`에 기록됩니다.

## GitHub Pages 배포

[.github/workflows/deploy-pages.yml](./.github/workflows/deploy-pages.yml)이 `main` push 또는 수동 실행 시 정적 빌드와 배포를 수행합니다.

1. GitHub 저장소 **Settings → Pages → Build and deployment**를 `GitHub Actions`로 설정합니다.
2. **Settings → Secrets and variables → Actions → Variables**에 다음 repository variable을 만듭니다.
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` — 최종 Pages URL
3. Supabase Auth의 운영 URL을 위 Pages URL로 등록합니다.
4. `main`에 push하거나 `Deploy GitHub Pages` workflow를 수동 실행합니다.

`next.config.ts`가 `GITHUB_REPOSITORY`를 읽어 프로젝트 Pages의 `basePath`와 asset prefix를 자동 적용합니다. 로컬에서 같은 산출물을 검증하려면 `pnpm build:pages`를 실행하고 `out/`을 확인합니다.

## 테스트

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build:pages
```

데이터베이스 테스트는 트랜잭션 안에서 가상 사용자를 만들고 마지막에 모두 rollback하므로 운영 데이터를 남기지 않습니다.

```bash
supabase db reset                         # 로컬 전체 migration 적용
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/workflow.sql
```

- [supabase/tests/workflow.sql](./supabase/tests/workflow.sql): 회원·투고·원고번호·접수·3인 배정·심사·수정·게재확정·최종본·발행호의 15단계 흐름
- [supabase/tests/rls.sql](./supabase/tests/rls.sql): 타 저자 접근, Reviewer의 저자정보 접근, Author의 Reviewer 정보 접근, 일반 사용자의 관리자 기능·역할 변경 차단
- [tests/rendered-html.test.mjs](./tests/rendered-html.test.mjs): 정적 렌더, 비밀키 유출, RLS/Storage migration, Reviewer UI 쿼리 경계

운영 전에는 실제 이메일 인증 정책에 맞춰 AUTHOR 2명, REVIEWER 3명, EDITOR 1명, ADMIN 1명의 별도 테스트 계정으로 같은 시나리오를 한 번 더 수행하는 것을 권장합니다.

## 백업과 복구

운영 백업은 데이터베이스와 Storage를 따로 보관합니다.

```bash
supabase db dump --linked -f backups/schema.sql
supabase db dump --linked --data-only -f backups/data.sql
```

- Supabase Dashboard의 예약 백업/PITR를 프로젝트 요금제에 맞게 활성화합니다.
- 비공개 bucket 파일은 정기적으로 별도 암호화 저장소에 동기화하고 객체 경로를 유지합니다.
- `manuscript_files` 데이터와 실제 Storage 객체 목록의 불일치 여부를 정기 점검합니다.
- 복구 훈련은 별도 Supabase 프로젝트에서 migration → data → Storage 순으로 수행합니다.
- `backups/`에는 개인정보와 원고가 포함되므로 Git에 커밋하지 않습니다.

## 운영 주의사항

- 저자가 업로드하는 심사용 파일에서 이름·소속·감사의 글·문서 속성이 제거되었는지 편집자가 형식검토 단계에서 확인합니다.
- 편집 판정과 상태 전이는 UI 우회 입력이 아닌 보안 RPC를 통해 처리합니다.
- 발행 PDF만 `published` bucket으로 옮기고, 원고·심사·최종 파일은 계속 비공개로 유지합니다.
- 회원 탈퇴나 논문 삭제는 기록보존 정책을 먼저 정한 뒤 별도 절차로 처리합니다. 현재 UI에는 파괴적 삭제 기능이 없습니다.
