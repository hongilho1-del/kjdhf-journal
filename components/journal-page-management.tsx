"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatDate, getErrorMessage, type BoardPost, type Profile } from "@/lib/journal";
import {
  JOURNAL_PAGE_STORAGE_PREFIX,
  getJournalPageDefinition,
  getJournalPageStorageTitle,
  journalInformationNavigation,
  type JournalInformationPage,
} from "@/lib/journal-pages";
import { getSupabaseClient } from "@/lib/supabase/client";

export function JournalPageManagement({ profile }: { profile: Profile }) {
  const [pages, setPages] = useState<BoardPost[]>([]);
  const [selectedPage, setSelectedPage] = useState<JournalInformationPage>("submission-guidelines");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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

  async function savePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const content = String(form.get("content") || "").trim();
    try {
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
      await loadPages();
      setMessage("안내 페이지 내용을 저장했습니다. 공개 페이지에 바로 반영됩니다.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="journal-page-admin-grid">
      <section className="workspace-card journal-page-admin-list">
        <div className="card-heading"><div><p>JOURNAL INFORMATION</p><h2>학회지 안내 페이지</h2></div><span>{pages.length} / 4</span></div>
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
          <label>페이지 내용<textarea name="content" rows={18} defaultValue={savedPage?.content ?? ""} placeholder="이 페이지에 공개할 내용을 입력해 주세요." required /></label>
          <div className="journal-page-editor-note">줄바꿈은 공개 페이지에서도 그대로 표시됩니다. 저장 즉시 방문자 화면에 반영됩니다.</div>
          <button className="button button-primary" disabled={busy}>{busy ? "저장 중…" : "안내 페이지 저장"}</button>
        </form>}
      </section>
    </div>
  );
}
