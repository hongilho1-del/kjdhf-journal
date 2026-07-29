"use client";

import { useEffect, useState } from "react";
import {
  getJournalPageDefinition,
  getJournalPageStorageTitle,
  journalInformationNavigation,
  type JournalInformationPage,
} from "@/lib/journal-pages";
import { parseJournalContent } from "@/lib/journal-content";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type JournalPageContent = {
  content: string;
  attachment_name: string | null;
  attachment_path: string | null;
  attachment_mime_type: string | null;
  attachment_size_bytes: number | null;
};

export { isJournalInformationPage, journalInformationNavigation, type JournalInformationPage } from "@/lib/journal-pages";

function JournalContent({ content }: { content: string }) {
  return <div className="journal-information-copy">{parseJournalContent(content).map((block, index) => block.type === "text"
    ? <div className="journal-information-text" key={`text-${index}`}>{block.content}</div>
    : <div className="journal-information-table-wrap" key={`table-${index}`}><table className="journal-information-table">
      <thead><tr>{block.headers.map((header, cellIndex) => <th scope="col" key={cellIndex}>{header}</th>)}</tr></thead>
      <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
    </table></div>
  )}</div>;
}

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
  const [contentByPage, setContentByPage] = useState<Partial<Record<JournalInformationPage, JournalPageContent>>>({});
  const pageContent = contentByPage[page];
  const content = pageContent?.content ?? "";
  const loading = isSupabaseConfigured && contentByPage[page] === undefined;
  const attachmentUrl = pageContent?.attachment_path
    ? getSupabaseClient().storage.from("published").getPublicUrl(pageContent.attachment_path, { download: pageContent.attachment_name ?? true }).data.publicUrl
    : null;

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    void getSupabaseClient().from("board_posts").select("content,attachment_name,attachment_path,attachment_mime_type,attachment_size_bytes").eq("title", getJournalPageStorageTitle(page)).eq("is_published", true).maybeSingle().then(({ data }) => {
      if (active) setContentByPage((current) => ({ ...current, [page]: data ?? { content: "", attachment_name: null, attachment_path: null, attachment_mime_type: null, attachment_size_bytes: null } }));
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
            <span>학술지 안내</span>
            <span>›</span>
            <strong>{copy.label}</strong>
          </nav>
        </div>
      </div>

      <div className="shell community-layout journal-information-layout">
        <aside className="community-side-nav journal-information-nav">
          <h2>학술지 안내</h2>
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
          {content || attachmentUrl ? <article className="journal-information-body">{content && <JournalContent content={content} />}{attachmentUrl && <a className="journal-template-download" href={attachmentUrl}><span>논문 양식 다운로드</span><strong>{pageContent?.attachment_name}</strong><b>↓</b></a>}</article> : <div className="journal-information-placeholder">
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
