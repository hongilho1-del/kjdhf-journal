"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatDate, getErrorMessage, type BoardCategory, type BoardPost } from "@/lib/journal";
import { getSupabaseClient } from "@/lib/supabase/client";

const emptyCategory: BoardCategory = "NOTICE";

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function BoardManagement() {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [editing, setEditing] = useState<BoardPost | null>(null);
  const [category, setCategory] = useState<BoardCategory>(emptyCategory);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadPosts = useCallback(async () => {
    const { data, error } = await getSupabaseClient().from("board_posts").select("*").order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setPosts(data ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPosts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  function startEdit(post: BoardPost) {
    setEditing(post);
    setCategory(post.category as BoardCategory);
    setMessage("");
  }

  function resetForm(form?: HTMLFormElement) {
    setEditing(null);
    setCategory(emptyCategory);
    form?.reset();
  }

  async function savePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const published = form.get("isPublished") === "on";
    const eventStart = String(form.get("eventStart") || "");
    if (category === "EVENT" && !eventStart) {
      setMessage("학회행사는 행사 시작일시를 입력해 주세요.");
      setBusy(false);
      return;
    }
    const payload = {
      category,
      title: String(form.get("title") || "").trim(),
      content: String(form.get("content") || "").trim(),
      location: category === "EVENT" ? String(form.get("location") || "").trim() || null : null,
      event_start_at: category === "EVENT" ? new Date(eventStart).toISOString() : null,
      event_end_at: category === "EVENT" && form.get("eventEnd") ? new Date(String(form.get("eventEnd"))).toISOString() : null,
      is_pinned: form.get("isPinned") === "on",
      is_published: published,
      published_at: published ? editing?.published_at ?? new Date().toISOString() : null,
    };
    try {
      const result = editing
        ? await getSupabaseClient().from("board_posts").update(payload).eq("id", editing.id)
        : await getSupabaseClient().from("board_posts").insert(payload);
      if (result.error) throw result.error;
      resetForm(event.currentTarget);
      await loadPosts();
      setMessage(editing ? "게시물을 수정했습니다." : "게시물을 등록했습니다.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(post: BoardPost) {
    setMessage("");
    const nextPublished = !post.is_published;
    const { error } = await getSupabaseClient().from("board_posts").update({
      is_published: nextPublished,
      published_at: nextPublished ? post.published_at ?? new Date().toISOString() : null,
    }).eq("id", post.id);
    if (error) setMessage(error.message);
    else { await loadPosts(); setMessage(nextPublished ? "게시물을 공개했습니다." : "게시물을 비공개로 전환했습니다."); }
  }

  async function removePost(post: BoardPost) {
    if (!window.confirm(`‘${post.title}’ 게시물을 삭제할까요?`)) return;
    const { error } = await getSupabaseClient().from("board_posts").delete().eq("id", post.id);
    if (error) setMessage(error.message);
    else { if (editing?.id === post.id) resetForm(); await loadPosts(); setMessage("게시물을 삭제했습니다."); }
  }

  return (
    <div className="board-admin-grid">
      <section className="workspace-card">
        <div className="card-heading"><div><p>COMMUNITY CONTENT</p><h2>공지·행사 관리</h2></div><span>{posts.length}건</span></div>
        {message && <div className="notice-box" role="status">{message}</div>}
        <div className="admin-post-list">
          {posts.length === 0 ? <div className="empty-state"><strong>등록된 게시물이 없습니다.</strong></div> : posts.map((post) => (
            <article key={post.id}>
              <div><span className={`board-category board-category-${post.category.toLowerCase()}`}>{post.category === "NOTICE" ? "공지" : "행사"}</span><strong>{post.title}</strong><small>{formatDate(post.published_at ?? post.created_at)} · {post.is_published ? "공개" : "비공개"}{post.is_pinned ? " · 중요" : ""}</small></div>
              <nav><button type="button" onClick={() => startEdit(post)}>수정</button><button type="button" onClick={() => void togglePublished(post)}>{post.is_published ? "비공개" : "공개"}</button><button className="danger-link" type="button" onClick={() => void removePost(post)}>삭제</button></nav>
            </article>
          ))}
        </div>
      </section>
      <section className="workspace-card board-editor-card">
        <div className="card-heading"><div><p>{editing ? "EDIT POST" : "NEW POST"}</p><h2>{editing ? "게시물 수정" : "새 게시물 등록"}</h2></div>{editing && <button type="button" onClick={() => resetForm()}>새 글</button>}</div>
        <form key={editing?.id ?? "new"} className="stack-form" onSubmit={savePost}>
          <label>게시판<select name="category" value={category} onChange={(event) => setCategory(event.target.value as BoardCategory)}><option value="NOTICE">공지사항</option><option value="EVENT">학회행사</option></select></label>
          <label>제목<input name="title" defaultValue={editing?.title ?? ""} required /></label>
          <label>내용<textarea name="content" rows={10} defaultValue={editing?.content ?? ""} required /></label>
          {category === "EVENT" && <div className="board-event-fields"><label>시작일시<input name="eventStart" type="datetime-local" defaultValue={toLocalInput(editing?.event_start_at ?? null)} required /></label><label>종료일시<input name="eventEnd" type="datetime-local" defaultValue={toLocalInput(editing?.event_end_at ?? null)} /></label><label>장소<input name="location" defaultValue={editing?.location ?? ""} /></label></div>}
          <div className="check-row"><label><input name="isPinned" type="checkbox" defaultChecked={editing?.is_pinned ?? false} /> 중요 게시물</label><label><input name="isPublished" type="checkbox" defaultChecked={editing?.is_published ?? true} /> 즉시 공개</label></div>
          <button className="button button-primary" disabled={busy}>{busy ? "저장 중…" : editing ? "수정 저장" : "게시물 등록"}</button>
        </form>
      </section>
    </div>
  );
}
