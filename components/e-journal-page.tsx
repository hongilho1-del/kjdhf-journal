"use client";

import { useEffect, useMemo, useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { formatDate, getErrorMessage } from "@/lib/journal";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getJournalFileUrl } from "@/lib/supabase/files";

type Issue = Tables<"issues">;
type Article = Tables<"published_articles">;
type Tab = "search" | "journal";

const assetBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function EJournalPage({ initialTab = "search", onBackHome }: { initialTab?: Tab; onBackHome: () => void }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseClient();
    void Promise.all([
      supabase.from("issues").select("*").eq("status", "PUBLISHED").order("publication_date", { ascending: false }),
      supabase.from("published_articles").select("*").order("published_at", { ascending: false }),
    ]).then(([issueResult, articleResult]) => {
      if (issueResult.error || articleResult.error) setMessage(issueResult.error?.message ?? articleResult.error?.message ?? "자료를 불러오지 못했습니다.");
      setIssues(issueResult.data ?? []);
      setArticles(articleResult.data ?? []);
      setLoading(false);
    });
  }, []);

  const visibleArticles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko-KR");
    if (!normalized) return articles;
    return articles.filter((article) => [
      article.title_ko,
      article.title_en,
      article.abstract_ko,
      article.abstract_en,
      article.doi ?? "",
      ...article.keywords_ko,
      ...article.keywords_en,
    ].some((value) => value.toLocaleLowerCase("ko-KR").includes(normalized)));
  }, [articles, query]);

  async function openPdf(article: Article) {
    if (!article.pdf_file_id) return;
    try {
      const url = await getJournalFileUrl(article.pdf_file_id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function changeTab(next: Tab) {
    setTab(next);
    window.history.pushState(null, "", `#e-journal?tab=${next}`);
  }

  const articlesByIssue = (issueId: string) => articles.filter((article) => article.issue_id === issueId).sort((a, b) => a.article_order - b.article_order);

  return <section className="ejournal-page">
    <div className="shell public-page-breadcrumb"><button type="button" onClick={onBackHome}>홈</button><span>›</span><b>e-Journal</b></div>
    <div className="ejournal-hero"><div className="shell"><small>e-JOURNAL</small><h1>논문 검색 · 학술지</h1><p>한국 디지털 건강체력학회지에서 발행한 논문과 권호를 확인합니다.</p></div></div>
    <div className="shell ejournal-shell">
      <nav className="ejournal-tabs" aria-label="e-Journal 메뉴">
        <button className={tab === "search" ? "active" : ""} type="button" onClick={() => changeTab("search")}>논문 검색</button>
        <button className={tab === "journal" ? "active" : ""} type="button" onClick={() => changeTab("journal")}>학술지</button>
      </nav>
      {tab === "search" ? <>
        <form className="ejournal-search" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="article-search">논문 검색</label>
          <div><input id="article-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="논문제목, 초록, 핵심어, DOI를 입력하세요" /><button type="submit">검색</button></div>
          <p>제목, 초록, 핵심어와 DOI를 기준으로 검색할 수 있습니다.</p>
        </form>
        <div className="ejournal-result-heading"><h2>논문 검색결과</h2><span>총 {visibleArticles.length}건</span></div>
        {loading ? <div className="empty-state">발행 논문을 불러오는 중입니다.</div> : visibleArticles.length ? <div className="ejournal-articles">
          {visibleArticles.map((article) => <article key={article.id}>
            <small>{formatDate(article.published_at)} · {article.doi ? `DOI ${article.doi}` : "한국 디지털 건강체력학회지"}</small>
            <h3>{article.title_ko}</h3><p className="article-title-en">{article.title_en}</p>
            <p>{article.abstract_ko}</p>
            <div>{article.keywords_ko.map((keyword) => <span key={keyword}>#{keyword}</span>)}</div>
            {article.pdf_file_id && <button type="button" onClick={() => void openPdf(article)}>원문 보기 ↗</button>}
          </article>)}
        </div> : <div className="empty-state"><strong>{query ? "검색된 논문이 없습니다." : "아직 발행된 논문이 없습니다."}</strong><p>발행호가 등록되면 이곳에서 검색할 수 있습니다.</p></div>}
      </> : <>
        <div className="ejournal-result-heading"><h2>발행 학술지</h2><span>총 {issues.length}개 권호</span></div>
        {loading ? <div className="empty-state">학술지 권호를 불러오는 중입니다.</div> : issues.length ? <div className="issue-list">
          {issues.map((issue) => <article key={issue.id} className="issue-card">
            <img className="issue-cover-image" src={`${assetBasePath}/images/kjdhp-vol01-cover.png`} alt={`${issue.title || `제${issue.volume}권 제${issue.issue_number}호`} 표지`} width={1036} height={1519} loading="lazy" />
            <div><small>{issue.year} · {formatDate(issue.publication_date)}</small><h3>{issue.title || `제${issue.volume}권 제${issue.issue_number}호`}</h3><p>수록 논문 {articlesByIssue(issue.id).length}편</p>
              <ol>{articlesByIssue(issue.id).map((article) => <li key={article.id}><button type="button" disabled={!article.pdf_file_id} onClick={() => void openPdf(article)}><span>{article.article_order}. {article.title_ko}</span><small>{article.page_start ? `${article.page_start}${article.page_end ? `–${article.page_end}` : ""}쪽` : ""}</small></button></li>)}</ol>
            </div>
          </article>)}
        </div> : <div className="empty-state"><strong>창간호를 준비하고 있습니다.</strong><p>발행 완료 후 권호와 논문 목록이 공개됩니다.</p></div>}
      </>}
      {message && <p className="form-message" role="status">{message}</p>}
    </div>
  </section>;
}
