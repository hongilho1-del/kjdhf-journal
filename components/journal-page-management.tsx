"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { formatDate, getErrorMessage, type BoardPost, type JournalTemplateFile, type Profile } from "@/lib/journal";
import { buildJournalTableTemplate } from "@/lib/journal-content";
import {
  JOURNAL_PAGE_STORAGE_PREFIX,
  getJournalPageDefinition,
  getJournalPageStorageTitle,
  journalPageManagementNavigation,
  type JournalInformationPage,
} from "@/lib/journal-pages";
import { getSupabaseClient } from "@/lib/supabase/client";

const TEMPLATE_MAX_BYTES = 20 * 1024 * 1024;

function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export function JournalPageManagement({ profile }: { profile: Profile }) {
  const [pages, setPages] = useState<BoardPost[]>([]);
  const [templateFiles, setTemplateFiles] = useState<JournalTemplateFile[]>([]);
  const [selectedPage, setSelectedPage] = useState<JournalInformationPage>("submission-guidelines");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tableColumns, setTableColumns] = useState(3);
  const [tableRows, setTableRows] = useState(3);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const loadPages = useCallback(async () => {
    setLoading(true);
    const [pageResult, fileResult] = await Promise.all([
      getSupabaseClient().from("board_posts").select("*").like("title", `${JOURNAL_PAGE_STORAGE_PREFIX}%`).order("updated_at", { ascending: false }),
      getSupabaseClient().from("journal_template_files").select("*").order("display_order").order("created_at"),
    ]);
    if (pageResult.error || fileResult.error) setMessage(pageResult.error?.message ?? fileResult.error?.message ?? "학술지 안내를 불러오지 못했습니다.");
    if (!pageResult.error) setPages(pageResult.data ?? []);
    if (!fileResult.error) setTemplateFiles(fileResult.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPages(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPages]);

  const definition = getJournalPageDefinition(selectedPage);
  const storageTitle = getJournalPageStorageTitle(selectedPage);
  const savedPage = pages.find((item) => item.title === storageTitle) ?? null;
  const savedPageCount = journalPageManagementNavigation.filter((item) => pages.some((page) => page.title === getJournalPageStorageTitle(item.id))).length;

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
    const content = String(form.get("content") || "").trim() || definition.description;
    const attachments = selectedPage === "manuscript-template"
      ? form.getAll("attachments").filter((item): item is File => item instanceof File && item.size > 0)
      : [];
    const uploadedFiles: Array<{ file: File; storagePath: string }> = [];
    try {
      for (const attachment of attachments) {
        const extension = attachment.name.split(".").pop()?.toLowerCase() ?? "";
        if (extension !== "hwpx") throw new Error("논문 양식은 HWPX 파일만 등록할 수 있습니다.");
        if (attachment.size > TEMPLATE_MAX_BYTES) throw new Error(`${attachment.name}: 파일은 20MB 이하로 등록해 주세요.`);
        const storagePath = `templates/${crypto.randomUUID()}.hwpx`;
        const { error: uploadError } = await getSupabaseClient().storage.from("published").upload(storagePath, attachment, {
          contentType: attachment.type || "application/octet-stream",
          upsert: false,
        });
        if (uploadError) throw uploadError;
        uploadedFiles.push({ file: attachment, storagePath });
      }
      const payload = {
        category: "NOTICE",
        title: storageTitle,
        content,
        is_pinned: false,
        is_published: true,
        published_at: savedPage?.published_at ?? new Date().toISOString(),
        author_id: profile.id,
      };
      const result = savedPage
        ? await getSupabaseClient().from("board_posts").update(payload).eq("id", savedPage.id)
        : await getSupabaseClient().from("board_posts").insert(payload);
      if (result.error) throw result.error;
      if (uploadedFiles.length) {
        const nextOrder = templateFiles.reduce((maximum, file) => Math.max(maximum, file.display_order), -1) + 1;
        const { error: metadataError } = await getSupabaseClient().from("journal_template_files").insert(uploadedFiles.map(({ file, storagePath }, index) => ({
          file_name: file.name,
          storage_path: storagePath,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          display_order: nextOrder + index,
          created_by: profile.id,
        })));
        if (metadataError) throw metadataError;
      }
      await loadPages();
      setMessage(uploadedFiles.length ? `안내 내용과 HWPX 논문 양식 ${uploadedFiles.length}개를 저장했습니다. 공개 페이지에 바로 반영됩니다.` : "안내 페이지 내용을 저장했습니다. 공개 페이지에 바로 반영됩니다.");
    } catch (error) {
      if (uploadedFiles.length) await getSupabaseClient().storage.from("published").remove(uploadedFiles.map((item) => item.storagePath));
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplateFile(file: JournalTemplateFile) {
    if (!window.confirm(`${file.file_name} 파일을 삭제할까요? 공개 다운로드 목록에서도 바로 사라집니다.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const { error: metadataError } = await getSupabaseClient().from("journal_template_files").delete().eq("id", file.id);
      if (metadataError) throw metadataError;
      const { error: storageError } = await getSupabaseClient().storage.from("published").remove([file.storage_path]);
      if (storageError) throw storageError;
      await loadPages();
      setMessage("논문 양식 파일을 삭제했습니다.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="journal-page-admin-grid">
      <section className="workspace-card journal-page-admin-list">
        <div className="card-heading"><div><p>JOURNAL INFORMATION</p><h2>학술지 안내 페이지</h2></div><span>{savedPageCount} / {journalPageManagementNavigation.length}</span></div>
        <nav>
          {journalPageManagementNavigation.map((item) => {
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
            <label>HWPX 논문 양식 파일<input name="attachments" type="file" accept=".hwpx,application/vnd.hancom.hwpx,application/zip,application/octet-stream" multiple /></label>
            <p>한 번에 여러 개 선택 가능 · HWPX만 등록 · 파일당 최대 20MB</p>
            <div className="journal-template-file-list">
              <header><strong>현재 등록 파일</strong><span>{templateFiles.length}개</span></header>
              {templateFiles.length ? templateFiles.map((file) => <article key={file.id}><div><strong>{file.file_name}</strong><small>{formatFileSize(file.size_bytes)}</small></div><button type="button" disabled={busy} onClick={() => void deleteTemplateFile(file)}>삭제</button></article>) : <p>등록된 HWPX 논문 양식이 없습니다.</p>}
            </div>
          </section>}
          <div className="journal-page-editor-note">줄바꿈과 삽입한 표는 공개 페이지에서도 그대로 표시됩니다. 저장 즉시 방문자 화면에 반영됩니다.</div>
          <button className="button button-primary" disabled={busy}>{busy ? "저장 중…" : "안내 페이지 저장"}</button>
        </form>}
      </section>
    </div>
  );
}
