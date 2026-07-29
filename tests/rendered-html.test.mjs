import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Korean digital health and fitness journal", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /한국 디지털 건강체력학회지/);
  assert.match(html, /건강과 체력의 미래/);
  assert.match(html, /최신발행학술지/);
  assert.match(html, /이중맹검 심사/);
  assert.match(html, /온라인 투고·심사 시작/);
  assert.match(html, /건강체력연구소/);
  assert.match(html, /관리자 로그인/);
  assert.match(html, /logos\/kjdhf-logo\.png/);
  assert.match(html, /논문투고 규정/);
  assert.match(html, /편집위원회/);
  assert.match(html, /연구 윤리위원회/);
  assert.match(html, /논문 양식 다운로드/);
});

test("journal information links use the supplied logo and open four dedicated views", async () => {
  const [home, information, pages, app] = await Promise.all([
    readFile(new URL("../components/public-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-information.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/journal-pages.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(home, /logos\/kjdhf-logo\.png/);
  assert.doesNotMatch(home, /jams-about-mark/);
  for (const page of ["submission-guidelines", "editorial-board", "research-ethics", "manuscript-template"]) {
    assert.match(home, new RegExp(page));
    assert.match(pages, new RegExp(page));
  }
  assert.match(app, /isJournalInformationPage\(hashPage\)/);
  assert.match(app, /<JournalInformation page=\{view\}/);
  assert.match(information, /논문 양식 준비 중/);
});

test("authenticated users get a My Page with personal manuscript management", async () => {
  const [app, author] = await Promise.all([
    readFile(new URL("../components/journal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/author-dashboard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(app, /session && <button className="my-page-link"/);
  assert.match(app, /function openMyPage\(\)/);
  assert.match(app, /#my-page/);
  assert.match(app, />My Page</);
  for (const label of ["나의 할 일", "논문 총괄현황", "논문 접수 현황", "논문 심사 진행 현황", "수정 논문 제출 현황", "최종 논문 제출 현황"]) {
    assert.match(author, new RegExp(label));
  }
  assert.match(author, /filteredManuscripts\.map/);
  assert.match(author, /신규 논문 투고/);
  assert.match(author, /수정원고 제출/);
  assert.match(author, /최종원고 제출/);
});

test("signup follows four JAMS-style steps and keeps new members pending approval", async () => {
  const [panel, migration] = await Promise.all([
    readFile(new URL("../components/auth-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729162000_signup_profile_metadata.sql", import.meta.url), "utf8"),
  ]);
  for (const label of ["회원선택", "약관동의", "회원정보입력", "가입완료"]) assert.match(panel, new RegExp(label));
  for (const field of ["fullName", "affiliation", "email", "passwordConfirm", "phone", "researchFields"]) assert.match(panel, new RegExp(`name="${field}"`));
  assert.match(panel, /Object\.values\(agreements\)\.every\(Boolean\)/);
  assert.match(panel, /관리자의 승인이 완료되면 로그인/);
  assert.match(migration, /research_fields/);
  assert.match(migration, /'AUTHOR'/);
  assert.match(migration, /false/);
  assert.doesNotMatch(panel, /service[_-]?role/i);
});

test("connects JAMS-style submission, e-Journal, KCI similarity, and anonymous review results", async () => {
  const [app, home, submission, ejournal, result, migration] = await Promise.all([
    readFile(new URL("../components/journal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/public-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/manuscript-submission-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/e-journal-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/author-review-result-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729150000_author_review_results.sql", import.meta.url), "utf8"),
  ]);
  assert.match(app, /#online-submission/);
  assert.match(app, /#e-journal\?tab=/);
  for (const label of ["신규논문제출", "수정논문제출", "최종논문제출", "내논문심사현황"]) assert.match(submission, new RegExp(label));
  assert.match(home + submission, /https:\/\/check\.kci\.go\.kr\//);
  assert.match(ejournal, /논문 검색/);
  assert.match(ejournal, /발행 학술지/);
  assert.match(result, /심사위원 \{review\.reviewer_no\}/);
  assert.match(result, /수정원고 제출/);
  assert.match(migration, /public\.owns_manuscript\(target_manuscript_id\)/);
  assert.doesNotMatch(migration.match(/returns table[\s\S]*?\)\nlanguage sql/)?.[0] ?? "", /reviewer_id|email|full_name/i);
  assert.doesNotMatch(migration, /editor_comments/);
});

test("new submissions use a full-page ethics-first authoring wizard", async () => {
  const [submission, author] = await Promise.all([
    readFile(new URL("../components/manuscript-submission-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/author-dashboard.tsx", import.meta.url), "utf8"),
  ]);
  for (const label of ["연구윤리서약", "논문·초록 입력", "저자정보", "원고파일", "단독저자", "공동저자", "교신저자로 지정"]) {
    assert.match(submission, new RegExp(label));
  }
  assert.match(submission, /Object\.values\(ethics\)\.every\(Boolean\)/);
  assert.match(submission, /is_corresponding: index === correspondingIndex/);
  assert.match(submission, /#online-submission\?mode=new&step=ethics/);
  assert.match(submission, /persistDraft/);
  assert.match(submission, /임시저장한 내용을 불러왔습니다/);
  assert.match(submission, /isKoreanText/);
  assert.match(submission, /isEnglishText/);
  assert.match(submission, /validatePaperLanguage\(\)/);
  assert.match(submission, /validateAuthorLanguage\(\)/);
  assert.doesNotMatch(submission, /\bSubmissionModal\b/);
  assert.match(author, /openNewSubmissionPage/);
  assert.match(author, /online-submission\?mode=new&step=ethics/);
  assert.match(author, /작성 이어가기/);
  assert.doesNotMatch(author, /showSubmission|\bSubmissionModal\b/);
});

test("editor assigns reviewers one at a time with a future due date", async () => {
  const editor = await readFile(new URL("../components/editor-dashboard.tsx", import.meta.url), "utf8");
  assert.match(editor, /심사위원을 1명씩 배정/);
  assert.match(editor, /심사위원 1명 배정/);
  assert.match(editor, /min=\{dateInputAfter\(1\)\}/);
  assert.match(editor, /defaultValue=\{dateInputAfter\(14\)\}/);
  assert.match(editor, /!assignedReviewerIds\.has\(item\.id\)/);
  assert.match(editor, /Math\.max\(manuscript\.round_no, 1\)/);
  assert.match(editor, /심사기한은 오늘 이후 날짜/);
  assert.match(editor, /\.neq\("status", "DRAFT"\)/);
  assert.match(editor, /assignmentAllowed/);
  assert.match(editor, /형식검토 시작/);
});

test("ships both supplied logos with the darker Kongju palette", async () => {
  const [journalLogo, transparentLogo, instituteLogo, css, app] = await Promise.all([
    stat(new URL("../public/logos/kjdhf-logo.png", import.meta.url)),
    readFile(new URL("../public/logos/kjdhf-logo-transparent.png", import.meta.url)),
    stat(new URL("../public/logos/health-fitness-institute-logo.png", import.meta.url)),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.ok(journalLogo.size > 10_000);
  assert.ok(transparentLogo.length > 10_000);
  assert.equal(transparentLogo[25], 6, "footer logo must be an RGBA PNG");
  assert.ok(instituteLogo.size > 10_000);
  assert.match(css, /--ink:\s*#061a38/i);
  assert.match(css, /--forest:\s*#082b5d/i);
  assert.match(app, /logos\/kjdhf-logo-transparent\.png/);
  assert.doesNotMatch(css.match(/\.jams-footer \.footer-brand[^}]+}/)?.[0] ?? "", /background:\s*white/i);
});

test("admin can edit review-information pages without exposing them as notices", async () => {
  const [editor, management, information, publicHome, board, community, rls] = await Promise.all([
    readFile(new URL("../components/editor-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-page-management.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-information.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/public-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/board-management.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/community-board.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729032000_member_approval_and_boards.sql", import.meta.url), "utf8"),
  ]);
  assert.match(editor, /profile\.role === "ADMIN"[^\n]+심사안내 관리/);
  assert.match(editor, /<JournalPageManagement profile=\{profile\}/);
  assert.match(management, /from\("board_posts"\).*update/s);
  assert.match(management, /from\("board_posts"\).*insert/s);
  assert.match(information, /getJournalPageStorageTitle\(page\)/);
  assert.match(publicHome, /KJDHF_PAGE:/);
  assert.match(community, /KJDHF_PAGE:/);
  assert.match(board, /isJournalPagePost/);
  assert.match(rls, /board_posts_admin_update/);
  assert.match(rls, /using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/);
});

test("keeps privileged credentials out of frontend source", async () => {
  const files = await Promise.all([
    readFile(new URL("../components/journal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/client.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  const source = files.join("\n");
  assert.doesNotMatch(source, /service[_-]?role/i);
  assert.doesNotMatch(source, /SUPABASE_ACCESS_TOKEN|DATABASE_PASSWORD/i);
  assert.match(source, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});

test("migrations define RLS, audit history, admin aliases, approval, three-reviewer workflow, boards, and private storage boundaries", async () => {
  const [schema, rls, buckets, policies, community, reviewerWorkflow, adminAliases] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260728165759_initial_schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260728165805_rls_and_workflow.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260728165955_storage_buckets.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729010000_storage_object_policies.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729032000_member_approval_and_boards.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729050000_three_reviewer_workflow.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729063000_admin_username_login.sql", import.meta.url), "utf8"),
  ]);
  for (const table of ["profiles", "manuscripts", "authors", "manuscript_files", "reviewer_assignments", "reviews", "editorial_decisions", "manuscript_status_history", "issues", "published_articles"]) {
    assert.match(schema, new RegExp(`create table public\\.${table}\\b`, "i"));
    assert.match(rls, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(rls, /get_reviewer_manuscripts/);
  assert.doesNotMatch(rls.match(/get_reviewer_manuscripts[\s\S]*?\$\$;/)?.[0] ?? "", /authors|email|affiliation/i);
  for (const bucket of ["manuscripts", "revisions", "review-files", "final-files", "published"]) assert.match(buckets, new RegExp(`'${bucket}'`));
  assert.match(policies, /journal_private_files_select/);
  assert.match(community, /create table public\.board_posts\b/i);
  assert.match(community, /alter table public\.board_posts enable row level security/i);
  assert.match(community, /set_user_activation/);
  assert.match(community, /profile_approval_history/);
  assert.match(community, /alter column is_active set default false/i);
  assert.match(reviewerWorkflow, /active_count\s*>=\s*3/i);
  assert.match(reviewerWorkflow, /accepted_count\s*>=\s*3/i);
  assert.match(adminAliases, /create table public\.admin_login_aliases\b/i);
  assert.match(adminAliases, /revoke all on public\.admin_login_aliases from anon, authenticated/i);
});

test("admin username login resolves email only inside the server function", async () => {
  const [panel, loginFunction] = await Promise.all([
    readFile(new URL("../components/auth-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/functions/admin-login/index.ts", import.meta.url), "utf8"),
  ]);
  assert.match(panel, /관리자 아이디/);
  assert.match(panel, /functions\.invoke\(["']admin-login["']/);
  assert.doesNotMatch(panel, /admin_login_aliases/);
  assert.match(loginFunction, /auth\.admin\.getUserById/);
  assert.match(loginFunction, /profile\.role !== ["']ADMIN["']/);
  assert.doesNotMatch(loginFunction, /return json\(\{[^}]*email/s);
});

test("reviewer UI never queries author identity tables", async () => {
  const reviewer = await readFile(new URL("../components/reviewer-dashboard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(reviewer, /\.from\(["']authors["']\)|\.from\(["']profiles["']\)/);
  assert.match(reviewer, /get_reviewer_manuscripts/);
  assert.match(reviewer, /get_reviewer_files/);
  assert.match(reviewer, /MIN_AUTHOR_COMMENT_ITEMS\s*=\s*10/);
  assert.match(reviewer, /심사의견 항목 추가/);
});

test("one account can receive multiple role workspaces without losing author access", async () => {
  const [app, editor, migration] = await Promise.all([
    readFile(new URL("../components/journal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/editor-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729172000_multi_role_accounts.sql", import.meta.url), "utf8"),
  ]);
  assert.match(app, /profile_roles/);
  assert.match(app, /role-workspace-switcher/);
  assert.match(editor, /set_user_roles/);
  assert.match(editor, /역할 중복 부여/);
  assert.match(migration, /create table public\.profile_roles/i);
  assert.match(migration, /create or replace function public\.has_app_role/i);
  assert.match(migration, /create or replace function public\.set_user_roles/i);
  assert.match(migration, /Authors cannot review their own manuscript/i);
});
