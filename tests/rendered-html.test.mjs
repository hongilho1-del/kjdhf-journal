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
  const [home, information, app] = await Promise.all([
    readFile(new URL("../components/public-home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-information.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/journal-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(home, /logos\/kjdhf-logo\.png/);
  assert.doesNotMatch(home, /jams-about-mark/);
  for (const page of ["submission-guidelines", "editorial-board", "research-ethics", "manuscript-template"]) {
    assert.match(home, new RegExp(page));
    assert.match(information, new RegExp(page));
  }
  assert.match(app, /isJournalInformationPage\(hashPage\)/);
  assert.match(app, /<JournalInformation page=\{view\}/);
  assert.match(information, /논문 양식 준비 중/);
});

test("ships both supplied logos with the darker Kongju palette", async () => {
  const [journalLogo, instituteLogo, css] = await Promise.all([
    stat(new URL("../public/logos/kjdhf-logo.png", import.meta.url)),
    stat(new URL("../public/logos/health-fitness-institute-logo.png", import.meta.url)),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.ok(journalLogo.size > 10_000);
  assert.ok(instituteLogo.size > 10_000);
  assert.match(css, /--ink:\s*#061a38/i);
  assert.match(css, /--forest:\s*#082b5d/i);
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
});
