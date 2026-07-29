"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { formatDate, getErrorMessage, type BoardPost, type Profile } from "@/lib/journal";
import { buildJournalTableTemplate } from "@/lib/journal-content";
import {
  JOURNAL_PAGE_STORAGE_PREFIX,
  getJournalPageDefinition,
  getJournalPageStorageTitle,
  journalInformationNavigation,
  type JournalInformationPage,
} from "@/lib/journal-pages";
import { getSupabaseClient } from "@/lib/supabase/client";

const TEMPLATE_EXTENSIONS = new Set(["pdf", "doc", "docx", "hwp", "hwpx"]);
const TEMPLATE_MAX_BYTES = 20 * 1024 * 1024;

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export function JournalPageManagement({ profile }: { profile: Profile }) {
  const [pages, setPages] = useState<BoardPost[]>([]);
  const [selectedPage, setSelectedPage] = useState<JournalInformationPage>("submission-guidelines");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tableColumns, setTableColumns] = useState(3);
  const [tableRows, setTableRows] = useState(3);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const loadPages = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getSupabaseClient()
      .from("board_posts")
      .select("*")
      .like("title", `${JOURNAL_PAGE_STORAGE_PREFIX}%`)
      .order("updated_at", { ascending: false });
    if (error) setMessage(error.message);
    else setPages(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPages(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPages]);

  const definition = getJournalPageDefinition(selectedPage);
  const storageTitle = getJournalPageStorageTitle(selectedPage);
  const savedPage = pages.find((item) => item.title === storageTitle) ?? null;
  const savedPageCount = journalInformationNavigation.filter((item) => pages.some((page) => page.title === getJournalPageStorageTitle(item.id))).length;

  function insertTable() {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const prefix = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
    const suffix = after && !after.startsWith("\n\n") ? (after.startsWith("\n") ? "\n" : "\n\n") : "";
    const table = buildJournalTableTemplate(tableColumns, tableRows);
    textarea.setRangeText(`${prefix}${table}${suffix}`, start, end, "end");
    textarea.focus();
  }

  async function savePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const content = String(form.get("content") || "").trim();
    const attachment = form.get("attachment");
    let uploadedPath: string | null = null;
    try {
      const hasNewAttachment = selectedPage === "manuscript-template" && attachment instanceof File && attachment.size > 0;
      if (hasNewAttachment) {
        const extension = attachment.name.split(".").pop()?.toLowerCase() ?? "";
        if (!TEMPLATE_EXTENSIONS.has(extension)) throw new Error("논문 양식은 PDF, DOC, DOCX, HWP, HWPX 파일만 등록할 수 있습니다.");
        if (attachment.size > TEMPLATE_MAX_BYTES) throw new Error("논문 양식 파일은 20MB 이하로 등록해 주세요.");
        uploadedPath = `templates/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await getSupabaseClient().storage.from("published").upload(uploadedPath, attachment, {
          contentType: attachment.type || "application/octet-stream",
          upsert: false,
        });
        if (uploadError) throw uploadError;
      }
      const payload = {
        category: "NOTICE",
        title: storageTitle,
        content,
        is_pinned: false,
        is_published: true,
        published_at: savedPage?.published_at ?? new Date().toISOString(),
        author_id: profile.id,
        attachment_name: hasNewAttachment ? attachment.name : savedPage?.attachment_name ?? null,
        attachment_path: uploadedPath ?? savedPage?.attachment_path ?? null,
        attachment_mime_type: hasNewAttachment ? attachment.type || "application/octet-stream" : savedPage?.attachment_mime_type ?? null,
        attachment_size_bytes: hasNewAttachment ? attachment.size : savedPage?.attachment_size_bytes ?? null,
      };
      const result = savedPage
        ? await getSupabaseClient().from("board_posts").update(payload).eq("id", savedPage.id)
        : await getSupabaseClient().from("board_posts").insert(payload);
      if (result.error) throw result.error;
      if (uploadedPath && savedPage?.attachment_path && savedPage.attachment_path !== uploadedPath) {
        await getSupabaseClient().storage.from("published").remove([savedPage.attachment_path]);
      }
      await loadPages();
      setMessage(uploadedPath ? "안내 페이지와 논문 양식 파일을 저장했습니다. 공개 페이지에 바로 반영됩니다." : "안내 페이지 내용을 저장했습니다. 공개 페이지에 바로 반영됩니다.");
    } catch (error) {
      if (uploadedPath) await getSupabaseClient().storage.from("published").remove([uploadedPath]);
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="journal-page-admin-grid">
      <section className="workspace-card journal-page-admin-list">
        <div className="card-heading"><div><p>JOURNAL INFORMATION</p><h2>학술지 안내 페이지</h2></div><span>{savedPageCount} / {journalInformationNavigation.length}</span></div>
        <nav>
          {journalInformationNavigation.map((item) => {
            const saved = pages.find((page) => page.title === getJournalPageStorageTitle(item.id));
            return <button className={selectedPage === item.id ? "active" : ""} type="button" onClick={() => { setSelectedPage(item.id); setMessage(""); }} key={item.id}>
              <span><strong>{item.label}</strong><small>{saved ? `${formatDate(saved.updated_at)} 수정` : "내용 미등록"}</small></span><b>›</b>
            </button>;
          })}
        </nav>
      </section>

      <section className="workspace-card journal-page-editor-card">
        <div className="card-heading"><div><p>{definition.eyebrow}</p><h2>{definition.label} 편집</h2></div><span>{savedPage ? "등록됨" : "신규"}</span></div>
        {message && <div className="notice-box" role="status">{message}</div>}
        {loading ? <div className="empty-state">안내 페이지를 불러오는 중입니다.</div> : <form key={`${selectedPage}-${savedPage?.updated_at ?? "new"}`} className="stack-form journal-page-editor-form" onSubmit={savePage}>
          <p>{definition.description}</p>
          {selectedPage === "submission-guidelines" && <section className="journal-table-insert">
            <div><strong>표 삽입</strong><p>필요한 크기를 선택하면 현재 커서 위치에 표가 추가됩니다. 삽입 후 제목과 내용을 직접 수정하세요.</p></div>
            <div className="journal-table-insert-controls">
              <label>열 수<input type="number" min={2} max={8} value={tableColumns} onChange={(event) => setTableColumns(Number(event.target.value))} /></label>
              <label>본문 행 수<input type="number" min={1} max={30} value={tableRows} onChange={(event) => setTableRows(Number(event.target.value))} /></label>
              <button type="button" onClick={insertTable}>표 추가 +</button>
            </div>
          </section>}
          <label>페이지 내용<textarea ref={contentTextareaRef} name="content" rows={18} defaultValue={savedPage?.content ?? ""} placeholder="이 페이지에 공개할 내용을 입력해 주세요." required /></label>
          {selectedPage === "manuscript-template" && <section className="journal-template-upload">
            <label>논문 양식 파일<input name="attachment" type="file" accept=".pdf,.doc,.docx,.hwp,.hwpx" /></label>
            <p>PDF, DOC, DOCX, HWP, HWPX · 최대 20MB</p>
            {savedPage?.attachment_name && <div><span>현재 등록 파일</span><strong>{savedPage.attachment_name}</strong><small>{savedPage.attachment_size_bytes ? formatFileSize(savedPage.attachment_size_bytes) : ""}</small></div>}
          </section>}
          <div className="journal-page-editor-note">줄바꿈과 삽입한 표는 공개 페이지에서도 그대로 표시됩니다. 저장 즉시 방문자 화면에 반영됩니다.</div>
          <button className="button button-primary" disabled={busy}>{busy ? "저장 중…" : "안내 페이지 저장"}</button>
        </form>}
      </section>
    </div>
  );
}
