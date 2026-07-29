"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate, type BoardCategory, type BoardPost } from "@/lib/journal";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

const BOARD_LABELS: Record<BoardCategory, string> = {
  NOTICE: "공지사항",
  EVENT: "학회행사",
};

export function CommunityBoard({
  category,
  initialPostId,
  onCategoryChange,
  onBackHome,
}: {
  category: BoardCategory;
  initialPostId?: string | null;
  onCategoryChange: (category: BoardCategory) => void;
  onBackHome: () => void;
}) {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [selected, setSelected] = useState<BoardPost | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadPosts = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      setMessage("게시판 연결 정보가 설정되지 않았습니다.");
      return;
    }
    setLoading(true);
    const { data, error } = await getSupabaseClient()
      .from("board_posts")
      .select("*")
      .eq("category", category)
      .eq("is_published", true)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false });
    if (error) {
      setMessage(error.message);
      setPosts([]);
    } else {
      const nextPosts = data ?? [];
      setPosts(nextPosts);
      setMessage("");
      setSelected(initialPostId ? nextPosts.find((post) => post.id === initialPostId) ?? null : null);
    }
    setLoading(false);
  }, [category, initialPostId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPosts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  const filteredPosts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return posts;
    return posts.filter((post) => `${post.title} ${post.content} ${post.location ?? ""}`.toLowerCase().includes(keyword));
  }, [posts, query]);

  return (
    <section className="community-page">
      <div className="community-hero">
        <div className="shell">
          <p>COMMUNITY</p>
          <h1>{BOARD_LABELS[category]}</h1>
          <nav aria-label="현재 위치"><button type="button" onClick={onBackHome}>홈</button><span>›</span><strong>{BOARD_LABELS[category]}</strong></nav>
        </div>
      </div>
      <div className="shell community-layout">
        <aside className="community-side-nav">
          <h2>알림마당</h2>
          <button className={category === "NOTICE" ? "active" : ""} type="button" onClick={() => onCategoryChange("NOTICE")}>공지사항 <span>›</span></button>
          <button className={category === "EVENT" ? "active" : ""} type="button" onClick={() => onCategoryChange("EVENT")}>학회행사 <span>›</span></button>
        </aside>
        <div className="community-content">
          {selected ? (
            <article className="board-detail">
              <div className="board-title-row">
                <span>{selected.category === "NOTICE" ? "공지" : "행사"}</span>
                <h2>{selected.title}</h2>
                <time>{formatDate(selected.published_at ?? selected.created_at)}</time>
              </div>
              {selected.category === "EVENT" && (
                <dl className="event-metadata">
                  <div><dt>행사일시</dt><dd>{formatDate(selected.event_start_at)}{selected.event_end_at ? ` ~ ${formatDate(selected.event_end_at)}` : ""}</dd></div>
                  <div><dt>장소</dt><dd>{selected.location || "추후 안내"}</dd></div>
                </dl>
              )}
              <div className="board-detail-copy">{selected.content}</div>
              <div className="board-detail-actions"><button type="button" onClick={() => setSelected(null)}>목록으로</button></div>
            </article>
          ) : (
            <>
              <div className="community-heading"><div><small>KJDHF COMMUNITY</small><h2>{BOARD_LABELS[category]}</h2></div><span>총 {filteredPosts.length}건</span></div>
              <div className="board-search"><label><span className="sr-only">게시물 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목 또는 내용 검색" /></label><button type="button">검색</button></div>
              {message && <div className="notice-box" role="status">{message}</div>}
              {loading ? <div className="empty-state">게시물을 불러오는 중입니다.</div> : filteredPosts.length === 0 ? <div className="empty-state"><strong>등록된 게시물이 없습니다.</strong></div> : (
                <div className="board-table-wrap">
                  <table className="board-table">
                    <thead><tr><th>번호</th><th>제목</th>{category === "EVENT" && <th>행사일</th>}<th>등록일</th></tr></thead>
                    <tbody>{filteredPosts.map((post, index) => <tr key={post.id}>
                      <td>{post.is_pinned ? <b className="pin-label">공지</b> : filteredPosts.length - index}</td>
                      <td><button type="button" onClick={() => setSelected(post)}>{post.title}</button>{post.is_pinned && <span className="new-label">중요</span>}</td>
                      {category === "EVENT" && <td>{formatDate(post.event_start_at)}</td>}
                      <td>{formatDate(post.published_at ?? post.created_at)}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
