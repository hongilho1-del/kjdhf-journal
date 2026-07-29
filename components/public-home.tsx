"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate, type BoardCategory, type BoardPost } from "@/lib/journal";
import type { JournalInformationPage } from "@/lib/journal-pages";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

const assetBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const fallbackNotices: BoardPost[] = [
  { id: "fallback-system", category: "NOTICE", title: "온라인 논문투고·심사 시스템 이용 안내", content: "저자, 심사위원, 편집위원은 로그인 후 역할별 업무를 이용할 수 있습니다.", event_start_at: null, event_end_at: null, location: null, is_pinned: true, is_published: true, published_at: "2026-07-29T00:00:00+09:00", author_id: null, created_at: "2026-07-29T00:00:00+09:00", updated_at: "2026-07-29T00:00:00+09:00" },
  { id: "fallback-ethics", category: "NOTICE", title: "연구윤리 및 이중맹검 심사 원칙 안내", content: "저자와 심사위원의 신원을 서로 공개하지 않는 이중맹검 심사를 원칙으로 합니다.", event_start_at: null, event_end_at: null, location: null, is_pinned: false, is_published: true, published_at: "2026-07-29T00:00:00+09:00", author_id: null, created_at: "2026-07-29T00:00:00+09:00", updated_at: "2026-07-29T00:00:00+09:00" },
];

const workflow = [
  ["01", "신규 투고", "저자정보와 익명 원고를 분리해 접수합니다."],
  ["02", "형식 검토", "편집위원이 투고요건과 파일을 확인합니다."],
  ["03", "이중맹검 심사", "배정된 3인의 심사위원이 독립적으로 심사합니다."],
  ["04", "판정 및 수정", "심사의견과 편집판정에 따라 수정본을 제출합니다."],
  ["05", "게재 및 발행", "최종원고를 발행호에 배정해 기록합니다."],
];

export function PublicHome({ onEnter, onSubmit, onOpenEJournal, onOpenBoard, onOpenInformation }: { onEnter: () => void; onSubmit: () => void; onOpenEJournal: (tab?: "search" | "journal") => void; onOpenBoard: (category: BoardCategory, postId?: string) => void; onOpenInformation: (page: JournalInformationPage) => void }) {
  const [posts, setPosts] = useState<BoardPost[]>(fallbackNotices);
  const [activeCategory, setActiveCategory] = useState<BoardCategory>("NOTICE");

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void getSupabaseClient().from("board_posts").select("*").eq("is_published", true).not("title", "like", "KJDHF_PAGE:%").order("is_pinned", { ascending: false }).order("published_at", { ascending: false }).limit(12).then(({ data }) => {
      if (data) setPosts(data);
    });
  }, []);

  const visiblePosts = useMemo(() => posts.filter((post) => post.category === activeCategory).slice(0, 4), [activeCategory, posts]);
  const featured = visiblePosts[0];

  return (
    <>
      <section className="jams-hero" id="journal-home">
        <div className="shell jams-hero-inner">
          <div>
            <p>KOREAN JOURNAL OF DIGITAL HEALTH &amp; FITNESS</p>
            <h1>건강과 체력의 미래를<br /><strong>디지털 연구</strong>로 연결합니다.</h1>
            <span>공정한 이중맹검 심사와 투명한 학술 기록을 위한 온라인 시스템</span>
          </div>
          <div className="jams-hero-actions">
            <button type="button" onClick={onSubmit}><small>AUTHOR</small><strong>신규 논문투고</strong><span>→</span></button>
            <button type="button" onClick={onEnter}><small>REVIEWER · EDITOR</small><strong>심사·편집 업무</strong><span>→</span></button>
          </div>
        </div>
      </section>

      <section className="jams-main-panels">
        <div className="shell jams-main-grid">
          <article className="jams-latest" id="latest-journal">
            <div className="jams-panel-heading">
              <div><small>e-JOURNAL</small><h2>최신발행학술지</h2></div>
              <button type="button" onClick={() => onOpenEJournal("journal")}>전체보기 +</button>
            </div>
            <div className="jams-latest-body">
              <div className="jams-cover" aria-label="한국 디지털 건강체력학회지 표지">
                <span>KJDHF</span>
                <strong>한국 디지털<br />건강체력학회지</strong>
                <small>KOREAN JOURNAL OF<br />DIGITAL HEALTH &amp; FITNESS</small>
                <i>VOL. 01</i>
              </div>
              <div className="jams-journal-info">
                <span>창간호 준비 중</span>
                <h3>한국 디지털 건강체력학회지</h3>
                <dl>
                  <div><dt>학술지명</dt><dd>한국 디지털 건강체력학회지</dd></div>
                  <div><dt>ISSN</dt><dd>발급 준비 중</dd></div>
                  <div><dt>최신권호</dt><dd>창간호 준비 중</dd></div>
                  <div><dt>발행논문</dt><dd>발행 준비 중</dd></div>
                </dl>
                <p>발행이 완료된 논문은 e-Journal에서 확인할 수 있습니다.</p>
              </div>
            </div>
          </article>

          <aside className="jams-notice" id="journal-notice">
            <div className="jams-notice-tabs">
              <button className={activeCategory === "NOTICE" ? "active" : ""} type="button" onClick={() => setActiveCategory("NOTICE")}>공지사항</button><button className={activeCategory === "EVENT" ? "active" : ""} type="button" onClick={() => setActiveCategory("EVENT")}>학회행사</button><button className="jams-more-button" type="button" onClick={() => onOpenBoard(activeCategory)} aria-label={`${activeCategory === "NOTICE" ? "공지사항" : "학회행사"} 더보기`}>+</button>
            </div>
            {featured ? <><button className="jams-featured-notice" type="button" onClick={() => onOpenBoard(activeCategory, featured.id)}>
              <small>{activeCategory}</small>
              <strong>{featured.title}</strong>
              <p>{featured.content}</p>
              <time>{formatDate(featured.published_at ?? featured.created_at)}</time>
            </button>
            <ul>
              {visiblePosts.slice(1).map((post) => (
                <li key={post.id}><button type="button" onClick={() => onOpenBoard(activeCategory, post.id)}><span>{post.title}</span><time>{formatDate(post.published_at ?? post.created_at)}</time></button></li>
              ))}
            </ul></> : <div className="empty-state"><strong>등록된 {activeCategory === "NOTICE" ? "공지사항" : "학회행사"}이 없습니다.</strong></div>}
          </aside>
        </div>
      </section>

      <section className="jams-quick-section" aria-label="온라인 업무 바로가기">
        <div className="shell">
          <div className="jams-quick-heading"><small>QUICK SERVICE</small><h2>온라인 업무 바로가기</h2></div>
          <div className="jams-quick-grid">
            {[
              ["01", "논문투고", "신규 원고를 제출하고 진행상태를 확인합니다."],
              ["02", "심사의뢰", "배정된 논문을 확인하고 심사의견을 제출합니다."],
              ["03", "편집업무", "형식검토, 심사위원 배정, 판정을 진행합니다."],
              ["04", "나의 할 일", "현재 역할에 맞는 업무와 마감일을 확인합니다."],
            ].map(([number, title, description], index) => (
              <button type="button" onClick={index === 0 ? onSubmit : onEnter} key={number}>
                <span>{number}</span><strong>{title}</strong><p>{description}</p><i>→</i>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="jams-about" id="journal-about">
        <div className="shell jams-about-grid">
          <div className="jams-about-title">
            <small>ABOUT THE JOURNAL</small>
            <h2>학회지 소개</h2>
            <div className="jams-about-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- static public asset must work on GitHub Pages basePath */}
              <img src={`${assetBasePath}/logos/kjdhf-logo.png`} alt="한국 디지털 건강체력학회지" width={1100} height={388} loading="lazy" />
            </div>
          </div>
          <div className="jams-about-copy">
            <h3>건강체력 연구의 디지털 전환과<br />신뢰할 수 있는 학술 소통을 지향합니다.</h3>
            <p>
              한국 디지털 건강체력학회지는 건강, 체력, 운동과학 및 디지털 기술의 융합 연구를 다루며,
              연구윤리와 이중맹검 원칙에 따라 투고부터 심사, 판정, 발행까지 모든 과정을 기록합니다.
            </p>
            <div className="jams-about-links" id="journal-policy">
              <button type="button" onClick={() => onOpenInformation("submission-guidelines")}>논문투고 규정 <span>→</span></button>
              <button type="button" onClick={() => onOpenInformation("editorial-board")}>편집위원회 <span>→</span></button>
              <button type="button" onClick={() => onOpenInformation("research-ethics")}>연구 윤리위원회 <span>→</span></button>
              <button type="button" onClick={() => onOpenInformation("manuscript-template")}>논문 양식 다운로드 <span>→</span></button>
            </div>
          </div>
        </div>
      </section>

      <section className="jams-workflow" id="journal-workflow">
        <div className="shell">
          <div className="jams-workflow-heading">
            <div><small>EDITORIAL WORKFLOW</small><h2>논문 투고·심사 절차</h2></div>
            <p>접수부터 발행까지 역할과 권한에 따라 안전하게 이어집니다.</p>
          </div>
          <ol>
            {workflow.map(([number, title, description]) => (
              <li key={number}><span>{number}</span><strong>{title}</strong><p>{description}</p></li>
            ))}
          </ol>
          <button className="jams-workflow-button" type="button" onClick={onSubmit}>온라인 투고·심사 시작 <span>→</span></button>
        </div>
      </section>

      <section className="jams-related" aria-label="관련 기관">
        <div className="shell jams-related-inner">
          <strong>관련 기관</strong>
          <nav>
            <a href="https://www.kongju.ac.kr/" target="_blank" rel="noreferrer">국립공주대학교 <span>↗</span></a>
            <a href="https://www.kci.go.kr/" target="_blank" rel="noreferrer">한국학술지인용색인 <span>↗</span></a>
            <a href="https://check.kci.go.kr/" target="_blank" rel="noreferrer">KCI 논문 유사도 검사 <span>↗</span></a>
            <a href="https://www.nrf.re.kr/" target="_blank" rel="noreferrer">한국연구재단 <span>↗</span></a>
          </nav>
        </div>
      </section>
    </>
  );
}
