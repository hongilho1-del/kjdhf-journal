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
  assert.match(html, /한국디지털건강체력연구/);
  assert.match(html, /건강과 체력의 미래/);
  assert.match(html, /최신발행학술지/);
  assert.match(html, /이중맹검 심사/);
  assert.match(html, /온라인 투고·심사 시작/);
  assert.match(html, /건강체력연구소/);
  assert.match(html, /관리자 로그인/);
  assert.match(html, /logos\/kjdhp-journal-logo\.png/);
  assert.match(html, /logos\/kjdhp-journal-logo\.png\?v=1/);
  assert.match(html, /images\/kjdhp-vol01-cover\.png/);
  assert.match(html, /투고규정·원고작성요령/);
  assert.match(html, /심사규정/);
  assert.match(html, /편집위원회/);
  assert.match(html, /연구·출판윤리/);
  assert.match(html, /교정·검수 지원/);
});

test("journal information links use the supplied logo and open five dedicated views in author workflow order", async () => {
  const [home, information, pages, app] = await Promise.all([
    readFile(new URL("../components/public-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-information.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/journal-pages.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(home, /logos\/kjdhp-journal-logo\.png/);
  assert.doesNotMatch(home, /jams-about-mark/);
  const orderedPages = ["submission-guidelines", "review-guidelines", "research-ethics", "editorial-board", "proofreading-support"];
  for (const page of orderedPages) {
    assert.match(pages, new RegExp(page));
  }
  for (let index = 1; index < orderedPages.length; index += 1) {
    assert.ok(pages.indexOf(`id: "${orderedPages[index - 1]}"`) < pages.indexOf(`id: "${orderedPages[index]}"`));
  }
  for (const label of ["투고규정·원고작성요령", "심사규정", "연구·출판윤리", "편집위원회", "교정·검수 지원"]) assert.match(pages, new RegExp(label));
  const publicNavigation = pages.match(/export const journalInformationNavigation = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
  assert.doesNotMatch(publicNavigation, /manuscriptTemplate/);
  assert.match(home, /journalInformationNavigation\.map/);
  assert.match(app, /isJournalInformationPage\(hashPage\)/);
  assert.match(app, /<JournalInformation page=\{view\}/);
  assert.match(information, /journal-template-library/);
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
  const [panel, migration, consentMigration] = await Promise.all([
    readFile(new URL("../components/auth-panel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729162000_signup_profile_metadata.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729190000_ethics_and_privacy_consents.sql", import.meta.url), "utf8"),
  ]);
  for (const label of ["회원선택", "약관동의", "회원정보입력", "가입완료"]) assert.match(panel, new RegExp(label));
  for (const field of ["fullName", "affiliation", "email", "passwordConfirm", "phone", "researchFields"]) assert.match(panel, new RegExp(`name="${field}"`));
  assert.match(panel, /Object\.values\(agreements\)\.every\(Boolean\)/);
  assert.match(panel, /관리자의 승인이 완료되면 로그인/);
  assert.match(migration, /research_fields/);
  assert.match(migration, /'AUTHOR'/);
  assert.match(migration, /false/);
  for (const consent of ["서비스 이용약관", "개인정보 수집 및 이용", "개인정보 국외이전", "학술정보 이메일 수신"]) assert.match(panel, new RegExp(consent));
  assert.match(panel, /requiredAgreementsComplete/);
  assert.match(panel, /consent_academic_email/);
  assert.match(consentMigration, /create table public\.user_consents/);
  assert.match(consentMigration, /policy_version/);
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
  assert.doesNotMatch(app, /jams-login-button[^\n]+온라인 투고·심사/);
  assert.match(app, /jams-system-button[^\n]+온라인 투고·심사/);
});

test("new submissions use a full-page ethics-first authoring wizard", async () => {
  const [submission, author] = await Promise.all([
    readFile(new URL("../components/manuscript-submission-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/author-dashboard.tsx", import.meta.url), "utf8"),
  ]);
  for (const label of ["연구윤리 동의", "저자구성·교신저자", "논문·초록 입력", "원고파일", "단독저자", "공동저자", "제1저자", "교신저자로 지정"]) {
    assert.match(submission, new RegExp(label));
  }
  assert.match(submission, /RESEARCH_PUBLICATION_ETHICS_POLICY/);
  assert.match(submission, /ethics_author_names/);
  assert.match(submission, /연구·출판윤리규정에 동의합니다/);
  assert.match(submission, /연구윤리 서약 연구자 명단/);
  assert.match(submission, /논문에 참여한 연구자 전원의 이름/);
  assert.match(submission, /ethicsAuthorNamesComplete/);
  assert.match(submission, /disabled=\{!ethicsAuthorNamesComplete\}/);
  assert.match(submission, /AUTHOR_COUNT_OPTIONS/);
  assert.match(submission, /length: 10/);
  assert.ok(submission.indexOf("STEP 01") < submission.indexOf("STEP 02"));
  assert.ok(submission.indexOf("저자 구성 및 교신저자 지정") < submission.indexOf("STEP 03"));
  assert.match(submission, /is_corresponding: index === correspondingIndex/);
  assert.match(submission, /#online-submission\?mode=new&step=ethics/);
  assert.match(submission, /persistDraft/);
  assert.match(submission, /임시저장한 내용을 불러왔습니다/);
  assert.match(submission, /isKoreanText/);
  assert.match(submission, /isEnglishText/);
  assert.match(submission, /validatePaperFields\(\)/);
  assert.match(submission, /한글·영문·숫자·문장부호를 함께 사용할 수 있습니다/);
  assert.doesNotMatch(submission, /논문제목\(국문\)은 한글로 작성해 주세요/);
  assert.doesNotMatch(submission, /논문제목\(영문\)은 영어로 작성해 주세요/);
  assert.doesNotMatch(submission, /국문초록은 한글로 작성해 주세요/);
  assert.doesNotMatch(submission, /영문초록은 영어로 작성해 주세요/);
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

test("ships the supplied journal logo and latest issue cover with the darker Kongju palette", async () => {
  const [journalLogo, cover, instituteLogo, css, app, home, ejournal] = await Promise.all([
    readFile(new URL("../public/logos/kjdhp-journal-logo.png", import.meta.url)),
    stat(new URL("../public/images/kjdhp-vol01-cover.png", import.meta.url)),
    stat(new URL("../public/logos/health-fitness-institute-logo.png", import.meta.url)),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/public-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/e-journal-page.tsx", import.meta.url), "utf8"),
  ]);
  assert.ok(journalLogo.length > 10_000);
  assert.equal(journalLogo[25], 6, "journal logo must be an RGBA PNG");
  assert.ok(cover.size > 10_000);
  assert.ok(instituteLogo.size > 10_000);
  assert.match(css, /--ink:\s*#061a38/i);
  assert.match(css, /--forest:\s*#082b5d/i);
  assert.match(app, /logos\/kjdhp-journal-logo\.png/);
  assert.match(home, /images\/kjdhp-vol01-cover\.png/);
  assert.match(ejournal, /images\/kjdhp-vol01-cover\.png/);
  assert.match(app, /https:\/\/prhome\.kongju\.ac\.kr\/sites\/hpflab/);
  assert.doesNotMatch(css.match(/\.jams-footer \.footer-brand[^}]+}/)?.[0] ?? "", /background:\s*white/i);
});

test("admin can edit review-information pages without exposing them as notices", async () => {
  const [editor, management, information, contentParser, publicHome, board, community, rls] = await Promise.all([
    readFile(new URL("../components/editor-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-page-management.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-information.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/journal-content.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/public-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/board-management.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/community-board.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729032000_member_approval_and_boards.sql", import.meta.url), "utf8"),
  ]);
  assert.match(editor, /profile\.role === "ADMIN"[^\n]+학술지 안내 관리/);
  assert.match(editor, /<JournalPageManagement profile=\{profile\}/);
  assert.match(management, /from\("board_posts"\).*update/s);
  assert.match(management, /from\("board_posts"\).*insert/s);
  assert.match(management, /selectedPage === "submission-guidelines"/);
  assert.match(management, /표 추가 \+/);
  assert.match(management, /buildJournalTableTemplate/);
  assert.match(management, /savedPageCount/);
  assert.match(management, /journalPageManagementNavigation\.length/);
  assert.match(information, /getJournalPageStorageTitle\(page\)/);
  assert.match(information, /<table className="journal-information-table">/);
  assert.match(information, /parseJournalContent/);
  assert.doesNotMatch(information, /dangerouslySetInnerHTML/);
  assert.match(contentParser, /type: "table"/);
  assert.match(contentParser, /Math\.min\(8, Math\.max\(2/);
  assert.match(contentParser, /Math\.min\(30, Math\.max\(1/);
  assert.match(publicHome, /KJDHF_PAGE:/);
  assert.match(community, /KJDHF_PAGE:/);
  assert.match(board, /isJournalPagePost/);
  assert.match(rls, /board_posts_admin_update/);
  assert.match(rls, /using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/);
});

test("public boards avoid admin function errors and journal information uses one label", async () => {
  const [community, app, home, information, management, boardManagement, journal, policy, identityMigration] = await Promise.all([
    readFile(new URL("../components/community-board.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/public-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-information.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-page-management.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/board-management.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/journal.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729200000_fix_public_board_read_policy.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729203000_journal_identity_wording.sql", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(community, /permission denied|notice-box/);
  assert.match(app, /학술지 안내/);
  assert.match(app, /투고·심사 안내/);
  assert.match(app, /학술대회/);
  assert.match(home, /학술지 안내/);
  assert.match(home, /한국디지털건강체력연구는 건강, 체력, 운동과학/);
  assert.match(community, /학술대회/);
  assert.match(boardManagement, /공지·학술대회 관리/);
  assert.match(information, /학술지 안내/);
  assert.match(management, /학술지 안내 페이지/);
  for (const source of [community, app, home, information, management, boardManagement]) {
    assert.doesNotMatch(source, /학회행사|학회지|>학회</);
    assert.doesNotMatch(source, /한국 디지털 건강체력학회지/);
  }
  assert.match(policy, /using \(is_published\)/);
  assert.match(policy, /board_posts_admin_read/);
  assert.doesNotMatch(policy.match(/board_posts_public_read[\s\S]*?;/)?.[0] ?? "", /is_admin/);
  assert.match(identityMigration, /replace\([\s\S]*한국 디지털 건강체력학회지[\s\S]*한국디지털건강체력연구/);
  assert.match(journal, /normalizeBoardPostIdentity/);
  assert.match(home + community + boardManagement, /map\(normalizeBoardPostIdentity\)/);
});

test("admins can publish multiple HWPX templates and authors can download each file", async () => {
  const [management, information, types, legacyMigration, multiFileMigration, pages, app, layout] = await Promise.all([
    readFile(new URL("../components/journal-page-management.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-information.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/database.types.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729201000_journal_template_attachment.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260809090000_multiple_hwpx_templates_and_proofreading_support.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/journal-pages.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(management, /name="attachments"/);
  assert.match(management, /multiple/);
  assert.match(management, /form\.getAll\("attachments"\)/);
  assert.match(management, /extension !== "hwpx"/);
  assert.match(management, /storage\.from\("published"\)\.upload/);
  assert.match(management, /from\("journal_template_files"\)\.insert/);
  assert.match(management, /from\("journal_template_files"\)\.delete/);
  assert.match(information, /getPublicUrl/);
  assert.match(information, /논문 양식 다운로드/);
  assert.match(information, /download=\{file\.file_name\}/);
  assert.match(information, /from\("journal_template_files"\)/);
  assert.match(information, /showsTemplateFiles && <section[\s\S]*\{content && <JournalContent/);
  assert.match(types, /journal_template_files/);
  assert.match(legacyMigration, /journal_template_files_admin_insert/);
  assert.match(multiFileMigration, /create table public\.journal_template_files/);
  assert.match(multiFileMigration, /journal_template_files_public_read/);
  assert.match(multiFileMigration, /public\.is_admin\(\)/);
  assert.match(multiFileMigration, /application\/vnd\.hancom\.hwpx/);
  assert.match(multiFileMigration, /KJDHF_PAGE:proofreading-support/);
  assert.match(multiFileMigration, /자율적인 선택/);
  assert.match(multiFileMigration, /이용을 강제하는 것이 아닙니다/);
  assert.match(pages, /proofreading-support/);
  assert.match(pages, /journalPageManagementNavigation/);
  assert.match(app, /institute-header-mark/);
  assert.match(layout, /rel="shortcut icon"/);
});

test("authors can upload HWPX files for initial, revision, and final manuscript submission", async () => {
  const [submission, dashboard, files, migration] = await Promise.all([
    readFile(new URL("../components/manuscript-submission-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/author-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/supabase/files.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260809090000_multiple_hwpx_templates_and_proofreading_support.sql", import.meta.url), "utf8"),
  ]);
  assert.match(files, /MANUSCRIPT_FILE_ACCEPT[\s\S]*\.hwpx/);
  assert.match(submission, /accept=\{MANUSCRIPT_FILE_ACCEPT\}/);
  assert.match(dashboard, /accept=\{MANUSCRIPT_FILE_ACCEPT\}/);
  assert.match(dashboard, /PDF, Word, HWP, HWPX/);
  assert.doesNotMatch(dashboard, /name="anonymized"/);
  assert.match(dashboard, /uploadJournalFile\(original, manuscript\.id, "ORIGINAL", 1\)/);
  assert.match(dashboard, /uploadJournalFile\(original, manuscript\.id, "ANONYMIZED", 1\)/);
  assert.match(migration, /application\/vnd\.hancom\.hwpx/);
  assert.match(migration, /where id in \('manuscripts', 'revisions', 'final-files'\)/);
});

test("administrators can export Excel ledgers and complete per-manuscript ZIP backups", async () => {
  const [dashboard, panel, exporter, packageJson] = await Promise.all([
    readFile(new URL("../components/editor-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/admin-data-export.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/admin-export.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /profile\.role === "ADMIN"[\s\S]*자료 내보내기/);
  assert.match(dashboard, /<AdminDataExport manuscripts=\{manuscripts\}/);
  assert.match(panel, /논문투고대장 Excel 다운로드/);
  assert.match(panel, /심사자대장 Excel 다운로드/);
  assert.match(panel, /선택 논문 전체자료 ZIP 다운로드/);
  for (const table of ["manuscripts", "authors", "profiles", "reviewer_assignments", "reviews", "editorial_decisions", "manuscript_files", "issues", "published_articles", "manuscript_status_history"]) assert.match(panel, new RegExp(`from\\("${table}"\\)`));
  assert.match(panel, /getJournalFileUrl\(file\.id\)/);
  assert.match(panel, /\.gte\("submitted_at"[\s\S]*\.lt\("submitted_at"/);
  assert.match(exporter, /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/);
  assert.match(exporter, /autoFilter/);
  assert.match(exporter, /ySplit="3"/);
  assert.match(exporter, /관리번호[\s\S]*투고일[\s\S]*담당편집위원[\s\S]*최종판정[\s\S]*게재권호/);
  assert.match(exporter, /심사의뢰일[\s\S]*수락·거절일[\s\S]*심사완료일[\s\S]*심사판정[\s\S]*심사차수/);
  assert.match(exporter, /01_논문정보\/저자목록\.csv/);
  assert.match(exporter, /02_심사\/심사결과\.json/);
  assert.match(exporter, /03_편집\/편집판정\.json/);
  assert.match(exporter, /04_파일\/\$\{folder\}/);
  assert.match(exporter, /zipSync/);
  assert.match(packageJson, /"fflate": "0\.7\.4"/);
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
  assert.doesNotMatch(panel, /placeholder=["']admin["']/);
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

test("administrators can inspect every workspace and bypass only wizard navigation validation", async () => {
  const [app, submission, journal] = await Promise.all([
    readFile(new URL("../components/journal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/manuscript-submission-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/journal.ts", import.meta.url), "utf8"),
  ]);
  assert.match(app, /isAdministrator\s*\?\s*ROLE_ORDER/);
  assert.match(app, /adminTestMode=\{roles\.includes\("ADMIN"\)\}/);
  assert.match(submission, /관리자 운영 테스트 모드/);
  assert.match(submission, /if \(!adminTestMode\) \{[\s\S]*?validatePaperFields/);
  assert.match(submission, /if \(!adminTestMode\) \{[\s\S]*?validateAuthorLanguage/);
  assert.match(submission, /required=\{!adminTestMode\}/);
  assert.match(submission, /disabled=\{busy \|\| \(!adminTestMode && !ethicsComplete\)\}/);
  assert.match(submission, /화면 점검 완료 · My Page/);
  assert.match(submission, /if \(!ethicsComplete\) return showValidationError/);
  assert.match(submission, /원고파일을 선택해 주세요/);
  assert.match(submission, /uploadJournalFile\(original, manuscriptId, "ORIGINAL", 1\)/);
  assert.match(submission, /uploadJournalFile\(original, manuscriptId, "ANONYMIZED", 1\)/);
  assert.doesNotMatch(submission, /name="anonymizedFile"/);
  assert.doesNotMatch(submission, /심사용 익명화 원고에는/);
  assert.match(journal, /timeZone:\s*"Asia\/Seoul"/);
});

test("authors can withdraw a submitted manuscript without deleting its audit record", async () => {
  const [author, statusMigration, withdrawalMigration, journal] = await Promise.all([
    readFile(new URL("../components/author-dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729180000_add_withdrawn_manuscript_status.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729180100_author_manuscript_withdrawal.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/journal.ts", import.meta.url), "utf8"),
  ]);
  assert.match(author, /withdraw_manuscript/);
  assert.match(author, /투고 철회 확정/);
  assert.match(author, /철회 후에는 되돌릴 수 없습니다/);
  assert.match(statusMigration, /alter type public\.manuscript_status add value if not exists 'WITHDRAWN'/i);
  assert.match(withdrawalMigration, /create or replace function public\.withdraw_manuscript/i);
  assert.match(withdrawalMigration, /created_by = auth\.uid\(\)/i);
  assert.match(withdrawalMigration, /set status = 'CANCELLED'/i);
  assert.match(withdrawalMigration, /manuscript_status_history/i);
  assert.match(withdrawalMigration, /Withdrawn manuscripts cannot be reactivated/i);
  assert.doesNotMatch(withdrawalMigration, /delete from public\.manuscripts/i);
  assert.match(journal, /WITHDRAWN: "투고철회"/);
});

test("new manuscripts receive the KJDHP journal code", async () => {
  const [migration, workflow, rls, readme] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260730003000_kjdhp_manuscript_codes.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/tests/workflow.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/tests/rls.sql", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /generated_code := 'KJDHP-'/);
  assert.match(migration, /\^KJDHP-\[0-9\]\{4\}-\[0-9\]\{3,\}\$/);
  assert.match(migration, /set last_number = coalesce/);
  for (const source of [workflow, rls, readme]) assert.match(source, /KJDHP-/);
  for (const source of [workflow, rls, readme]) assert.doesNotMatch(source, /KJDHF-/);
});
