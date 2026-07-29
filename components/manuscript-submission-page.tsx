"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSubmissionModal, SubmissionModal, openAuthorReviewResult } from "@/components/author-dashboard";
import { STATUS_LABELS, formatDate, type Manuscript, type Profile } from "@/lib/journal";
import { getSupabaseClient } from "@/lib/supabase/client";

type SubmissionTab = "new" | "revision" | "final" | "status";

const TAB_COPY: Record<SubmissionTab, { title: string; description: string }> = {
  new: { title: "신규논문제출", description: "논문 기본정보, 저자정보와 익명화 원고를 등록합니다." },
  revision: { title: "수정논문제출", description: "심사의견을 확인한 뒤 익명화된 수정원고를 제출합니다." },
  final: { title: "최종논문제출", description: "게재 판정을 받은 논문의 최종 편집원고를 제출합니다." },
  status: { title: "내논문심사현황", description: "투고 논문의 현재 상태와 공개된 심사결과를 확인합니다." },
};

export function ManuscriptSubmissionPage({ profile, onMyPage }: { profile: Profile; onMyPage: () => void }) {
  const [tab, setTab] = useState<SubmissionTab>("new");
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmission, setShowSubmission] = useState(false);
  const [fileTarget, setFileTarget] = useState<{ manuscript: Manuscript; mode: "draft" | "revision" | "final" } | null>(null);

  const loadManuscripts = useCallback(async () => {
    setLoading(true);
    const { data } = await getSupabaseClient().from("manuscripts").select("*").order("created_at", { ascending: false });
    setManuscripts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadManuscripts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadManuscripts]);

  const visible = useMemo(() => {
    if (tab === "revision") return manuscripts.filter((item) => item.status === "REVISION_REQUESTED");
    if (tab === "final") return manuscripts.filter((item) => ["ACCEPTED", "ACCEPT_WITH_REVISIONS"].includes(item.status));
    return manuscripts;
  }, [manuscripts, tab]);

  if (profile.role !== "AUTHOR") return <div className="submission-access-card"><small>ONLINE SUBMISSION</small><h2>투고자 전용 메뉴입니다.</h2><p>현재 계정은 {profile.role === "REVIEWER" ? "심사위원" : "편집 업무"} 권한으로 로그인되어 있습니다. 역할별 업무는 My Page에서 이용해 주세요.</p><button className="button button-primary" type="button" onClick={onMyPage}>My Page로 이동</button></div>;

  return <div className="submission-center">
    <section className="submission-center-hero"><div><small>ONLINE MANUSCRIPT SUBMISSION</small><h1>온라인 논문 투고</h1><p>한국 디지털 건강체력학회지 논문 제출과 진행상태를 관리합니다.</p></div><button type="button" onClick={onMyPage}>My Page <span>→</span></button></section>
    <nav className="submission-center-tabs" aria-label="논문 제출 메뉴">
      {(Object.keys(TAB_COPY) as SubmissionTab[]).map((id) => <button className={tab === id ? "active" : ""} type="button" onClick={() => setTab(id)} key={id}><strong>{TAB_COPY[id].title}</strong><span>→</span></button>)}
    </nav>
    <div className="submission-center-body">
      <section className="submission-main-card">
        <div className="submission-section-title"><small>AUTHOR SERVICE</small><h2>{TAB_COPY[tab].title}</h2><p>{TAB_COPY[tab].description}</p></div>
        {tab === "new" ? <div className="new-submission-guide">
          <ol><li><span>01</span><div><strong>연구윤리 및 저작권 확인</strong><p>모든 저자가 연구윤리와 중복투고 금지 원칙을 확인합니다.</p></div></li><li><span>02</span><div><strong>논문·저자정보 입력</strong><p>국·영문 제목과 초록, 핵심어, 교신저자 및 공동저자를 등록합니다.</p></div></li><li><span>03</span><div><strong>원고파일 제출</strong><p>편집용 원고와 저자정보를 제거한 익명화 원고를 각각 업로드합니다.</p></div></li></ol>
          <button className="button button-primary" type="button" onClick={() => setShowSubmission(true)}>신규 논문 등록 시작 <span>→</span></button>
          <p className="submission-note">접수 전 임시저장 상태에서는 입력정보를 보완할 수 있습니다.</p>
        </div> : <SubmissionList tab={tab} manuscripts={visible} loading={loading} onFile={(manuscript, mode) => setFileTarget({ manuscript, mode })} />}
      </section>
      <aside className="submission-side">
        <article><small>BEFORE SUBMISSION</small><h3>논문 유사도 확인</h3><p>투고 전 KCI 논문 유사도 검사 결과를 확인해 주세요.</p><a href="https://check.kci.go.kr/" target="_blank" rel="noreferrer">KCI 논문 유사도 서비스 <span>↗</span></a></article>
        <article><small>DOUBLE-BLIND REVIEW</small><h3>익명화 원고 안내</h3><p>저자명, 소속, 감사의 글 등 저자를 식별할 수 있는 정보를 익명 원고에서 반드시 제거해 주세요.</p></article>
      </aside>
    </div>
    {showSubmission && <SubmissionModal profile={profile} onClose={() => setShowSubmission(false)} onComplete={loadManuscripts} />}
    {fileTarget && <FileSubmissionModal {...fileTarget} onClose={() => setFileTarget(null)} onComplete={loadManuscripts} />}
  </div>;
}

function SubmissionList({ tab, manuscripts, loading, onFile }: { tab: Exclude<SubmissionTab, "new">; manuscripts: Manuscript[]; loading: boolean; onFile: (manuscript: Manuscript, mode: "draft" | "revision" | "final") => void }) {
  if (loading) return <div className="empty-state">투고 논문을 불러오는 중입니다.</div>;
  if (!manuscripts.length) return <div className="empty-state"><strong>해당하는 논문이 없습니다.</strong><p>진행상태가 변경되면 이 목록에서 확인할 수 있습니다.</p></div>;
  return <div className="data-table-wrap"><table className="data-table submission-list-table"><thead><tr><th>논문번호</th><th>논문제목</th><th>제출일</th><th>현재상태</th><th>업무</th></tr></thead><tbody>
    {manuscripts.map((manuscript) => <tr key={manuscript.id}><td><b>{manuscript.manuscript_code ?? "임시저장"}</b></td><td><strong>{manuscript.title_ko}</strong><small>{manuscript.title_en}</small></td><td>{formatDate(manuscript.submitted_at ?? manuscript.created_at)}</td><td><span className={`status-badge status-${manuscript.status.toLowerCase()}`}>{STATUS_LABELS[manuscript.status]}</span></td><td><div className="table-actions">
      {tab === "revision" && <button type="button" onClick={() => openAuthorReviewResult(manuscript.id)}>결과·수정 제출</button>}
      {tab === "final" && <button type="button" onClick={() => onFile(manuscript, "final")}>최종원고 제출</button>}
      {tab === "status" && !["DRAFT", "SUBMITTED", "RECEIVED", "FORMAT_REVIEW", "REVIEWER_SELECTION"].includes(manuscript.status) && <button type="button" onClick={() => openAuthorReviewResult(manuscript.id)}>결과</button>}
      {tab === "status" && manuscript.status === "DRAFT" && <button type="button" onClick={() => onFile(manuscript, "draft")}>파일 추가·제출</button>}
    </div></td></tr>)}
  </tbody></table></div>;
}
