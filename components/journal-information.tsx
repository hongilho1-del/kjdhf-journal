"use client";

import { useEffect, useState } from "react";
import {
  getJournalPageDefinition,
  getJournalPageStorageTitle,
  journalInformationNavigation,
  type JournalInformationPage,
} from "@/lib/journal-pages";
import { parseJournalContent } from "@/lib/journal-content";
import type { JournalTemplateFile } from "@/lib/journal";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type JournalPageContent = {
  content: string;
  attachment_name: string | null;
  attachment_path: string | null;
  attachment_mime_type: string | null;
  attachment_size_bytes: number | null;
};

export { isJournalInformationPage, journalInformationNavigation, type JournalInformationPage } from "@/lib/journal-pages";

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

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
  const [templateFiles, setTemplateFiles] = useState<JournalTemplateFile[]>([]);
  const [templateFilesLoaded, setTemplateFilesLoaded] = useState(false);
  const pageContent = contentByPage[page];
  const content = pageContent?.content ?? "";
  const loading = isSupabaseConfigured && contentByPage[page] === undefined;
  const showsTemplateFiles = page === "submission-guidelines" || page === "manuscript-template";
  const visibleTemplateFiles = [...templateFiles];
  if (pageContent?.attachment_path && pageContent.attachment_name && !visibleTemplateFiles.some((file) => file.storage_path === pageContent.attachment_path)) {
    visibleTemplateFiles.push({ id: `legacy-${pageContent.attachment_path}`, file_name: pageContent.attachment_name, storage_path: pageContent.attachment_path, mime_type: pageContent.attachment_mime_type ?? "application/octet-stream", size_bytes: pageContent.attachment_size_bytes ?? 0, display_order: -1, created_by: null, created_at: "", updated_at: "" });
  }
  const downloadableTemplates = visibleTemplateFiles.map((file) => ({
    file,
    url: getSupabaseClient().storage.from("published").getPublicUrl(file.storage_path, { download: file.file_name }).data.publicUrl,
  }));

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const pageRequest = getSupabaseClient().from("board_posts").select("content,attachment_name,attachment_path,attachment_mime_type,attachment_size_bytes").eq("title", getJournalPageStorageTitle(page)).eq("is_published", true).maybeSingle();
    const fileRequest = showsTemplateFiles
      ? getSupabaseClient().from("journal_template_files").select("*").order("display_order").order("created_at")
      : Promise.resolve({ data: null, error: null });
    void Promise.all([pageRequest, fileRequest]).then(([pageResult, fileResult]) => {
      if (!active) return;
      setContentByPage((current) => ({ ...current, [page]: pageResult.data ?? { content: "", attachment_name: null, attachment_path: null, attachment_mime_type: null, attachment_size_bytes: null } }));
      if (showsTemplateFiles) {
        setTemplateFiles(fileResult.data ?? []);
        setTemplateFilesLoaded(true);
      }
    });
    return () => { active = false; };
  }, [page, showsTemplateFiles]);

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
          {content || showsTemplateFiles ? <article className="journal-information-body">{showsTemplateFiles && <section className="journal-template-library" aria-labelledby="journal-template-library-title"><header><div><small>MANUSCRIPT TEMPLATE FILES</small><h3 id="journal-template-library-title">논문 양식 다운로드</h3><p>파일명을 누르면 HWPX 논문 양식이 바로 다운로드됩니다.</p></div><span>{downloadableTemplates.length}개</span></header>{downloadableTemplates.length ? <div className="journal-template-download-list">{downloadableTemplates.map(({ file, url }) => <a className="journal-template-download" href={url} download={file.file_name} key={file.id}><span>HWPX 논문 양식</span><strong>{file.file_name}</strong><small>{file.size_bytes ? formatFileSize(file.size_bytes) : ""}</small><b>↓</b></a>)}</div> : <div className="journal-template-empty">{templateFilesLoaded ? "등록된 논문 양식이 없습니다." : "논문 양식을 불러오고 있습니다."}</div>}</section>}{content && <JournalContent content={content} />}</article> : <div className="journal-information-placeholder">
            <span>CONTENT PREPARING</span>
            <h3>{loading ? "내용을 불러오고 있습니다." : "내용을 준비하고 있습니다."}</h3>
            <p>{copy.description}<br />관리자가 내용을 등록하면 이 페이지에 바로 표시됩니다.</p>
          </div>}
        </div>
      </div>
    </section>
  );
}
