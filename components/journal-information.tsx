"use client";

import { useEffect, useState } from "react";
import {
  getJournalPageDefinition,
  getJournalPageStorageTitle,
  journalInformationNavigation,
  type JournalInformationPage,
} from "@/lib/journal-pages";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

export { isJournalInformationPage, journalInformationNavigation, type JournalInformationPage } from "@/lib/journal-pages";

export function JournalInformation({
  page,
  onNavigate,
  onBackHome,
}: {
  page: JournalInformationPage;
  onNavigate: (page: JournalInformationPage) => void;
  onBackHome: () => void;
}) {
  const copy = getJournalPageDefinition(page);
  const [contentByPage, setContentByPage] = useState<Partial<Record<JournalInformationPage, string>>>({});
  const content = contentByPage[page] ?? "";
  const loading = isSupabaseConfigured && contentByPage[page] === undefined;

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    void getSupabaseClient().from("board_posts").select("content").eq("title", getJournalPageStorageTitle(page)).eq("is_published", true).maybeSingle().then(({ data }) => {
      if (active) setContentByPage((current) => ({ ...current, [page]: data?.content ?? "" }));
    });
    return () => { active = false; };
  }, [page]);

  return (
    <section className="journal-information-page">
      <div className="community-hero">
        <div className="shell">
          <p>ABOUT THE JOURNAL</p>
          <h1>{copy.label}</h1>
          <nav aria-label="현재 위치">
            <button type="button" onClick={onBackHome}>홈</button>
            <span>›</span>
            <strong>{copy.label}</strong>
          </nav>
        </div>
      </div>

      <div className="shell community-layout journal-information-layout">
        <aside className="community-side-nav journal-information-nav">
          <h2>학회지 안내</h2>
          {journalInformationNavigation.map((item) => (
            <button className={page === item.id ? "active" : ""} type="button" onClick={() => onNavigate(item.id)} key={item.id}>
              {item.label} <span>›</span>
            </button>
          ))}
        </aside>

        <div className="journal-information-content">
          <div className="community-heading">
            <div><small>{copy.eyebrow}</small><h2>{copy.label}</h2></div>
          </div>
          {content ? <article className="journal-information-body">{content}</article> : <div className="journal-information-placeholder">
            <span>CONTENT PREPARING</span>
            <h3>{loading ? "내용을 불러오고 있습니다." : "내용을 준비하고 있습니다."}</h3>
            <p>{copy.description}<br />관리자가 내용을 등록하면 이 페이지에 바로 표시됩니다.</p>
            {page === "manuscript-template" && (
              <button type="button" disabled>논문 양식 준비 중</button>
            )}
          </div>}
        </div>
      </div>
    </section>
  );
}
