import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("migrations define RLS, audit history, and private storage boundaries", async () => {
  const [schema, rls, buckets, policies] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260728165759_initial_schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260728165805_rls_and_workflow.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260728165955_storage_buckets.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260729010000_storage_object_policies.sql", import.meta.url), "utf8"),
  ]);
  for (const table of ["profiles", "manuscripts", "authors", "manuscript_files", "reviewer_assignments", "reviews", "editorial_decisions", "manuscript_status_history", "issues", "published_articles"]) {
    assert.match(schema, new RegExp(`create table public\\.${table}\\b`, "i"));
    assert.match(rls, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(rls, /get_reviewer_manuscripts/);
  assert.doesNotMatch(rls.match(/get_reviewer_manuscripts[\s\S]*?\$\$;/)?.[0] ?? "", /authors|email|affiliation/i);
  for (const bucket of ["manuscripts", "revisions", "review-files", "final-files", "published"]) assert.match(buckets, new RegExp(`'${bucket}'`));
  assert.match(policies, /journal_private_files_select/);
});

test("reviewer UI never queries author identity tables", async () => {
  const reviewer = await readFile(new URL("../components/reviewer-dashboard.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(reviewer, /\.from\(["']authors["']\)|\.from\(["']profiles["']\)/);
  assert.match(reviewer, /get_reviewer_manuscripts/);
  assert.match(reviewer, /get_reviewer_files/);
});
