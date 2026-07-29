"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSubmissionModal } from "@/components/author-dashboard";
import { DECISION_LABELS, RECOMMENDATION_LABELS, STATUS_LABELS, formatDate, type Manuscript } from "@/lib/journal";
import { getSupabaseClient } from "@/lib/supabase/client";

type ReviewResult = {
  reviewer_no: number;
  round_no: number;
  recommendation: keyof typeof RECOMMENDATION_LABELS;
  author_comments: string;
  submitted_at: string;
};

type DecisionResult = {
  decision: keyof typeof DECISION_LABELS;
  author_letter: string;
  round_no: number;
  decided_at: string;
};

export function AuthorReviewResultPage({ manuscriptId, onMyPage }: { manuscriptId: string | null; onMyPage: () => void }) {
  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [reviews, setReviews] = useState<ReviewResult[]>([]);
  const [decisions, setDecisions] = useState<DecisionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showRevision, setShowRevision] = useState(false);

  const loadResult = useCallback(async () => {
    if (!manuscriptId) { setMessage("논문 정보가 지정되지 않았습니다."); setLoading(false); return; }
    const supabase = getSupabaseClient();
    const [manuscriptResult, reviewResult, decisionResult] = await Promise.all([
      supabase.from("manuscripts").select("*").eq("id", manuscriptId).maybeSingle(),
      supabase.rpc("get_author_review_results", { target_manuscript_id: manuscriptId }),
      supabase.rpc("get_author_decisions", { target_manuscript_id: manuscriptId }),
    ]);
    if (manuscriptResult.error || !manuscriptResult.data) setMessage("논문을 찾을 수 없거나 접근 권한이 없습니다.");
    else setManuscript(manuscriptResult.data);
    if (reviewResult.error) setMessage((current) => current || "공개된 심사의견을 불러오지 못했습니다.");
    else setReviews((reviewResult.data ?? []) as ReviewResult[]);
    if (!decisionResult.error) setDecisions((decisionResult.data ?? []) as DecisionResult[]);
    setLoading(false);
  }, [manuscriptId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadResult(), 0);
    return () => window.clearTimeout(timer);
  }, [loadResult]);

  if (loading) return <div className="review-result-loading">심사결과를 불러오는 중입니다.</div>;
  if (!manuscript) return <section className="review-result-page"><div className="shell review-result-shell"><div className="empty-state"><strong>심사결과를 열 수 없습니다.</strong><p>{message}</p><button className="button button-primary" type="button" onClick={onMyPage}>My Page로 이동</button></div></div></section>;

  return <section className="review-result-page">
    <div className="review-result-hero"><div className="shell"><small>AUTHOR · REVIEW RESULT</small><h1>심사결과 및 수정논문 제출</h1><p>심사위원 신원은 공개되지 않으며 저자 공개용 심사의견만 확인할 수 있습니다.</p></div></div>
    <div className="shell review-result-shell">
      <div className="review-result-actions"><button type="button" onClick={() => window.close()}>창 닫기</button><button type="button" onClick={onMyPage}>My Page <span>→</span></button></div>
      <section className="review-manuscript-summary">
        <div><span>논문번호</span><strong>{manuscript.manuscript_code ?? "임시저장"}</strong></div>
        <div><span>현재상태</span><strong>{STATUS_LABELS[manuscript.status]}</strong></div>
        <div className="wide"><span>논문제목</span><strong>{manuscript.title_ko}</strong><small>{manuscript.title_en}</small></div>
        <div className="wide"><span>국문초록</span><p>{manuscript.abstract_ko}</p></div>
      </section>

      <section className="review-result-section">
        <div className="review-section-heading"><small>REVIEW COMMENTS</small><h2>심사의견</h2><span>저자 공개 내용</span></div>
        {reviews.length ? <div className="anonymous-review-list">{reviews.map((review) => <article key={`${review.round_no}-${review.reviewer_no}-${review.submitted_at}`}>
          <header><div><span>심사위원 {review.reviewer_no}</span><small>{review.round_no}차 심사</small></div><strong>{RECOMMENDATION_LABELS[review.recommendation]}</strong></header>
          <p>{review.author_comments}</p><time>제출일 {formatDate(review.submitted_at)}</time>
        </article>)}</div> : <div className="empty-state"><strong>공개된 심사의견이 없습니다.</strong><p>심사가 완료되고 편집결정이 공개되면 이곳에서 확인할 수 있습니다.</p></div>}
      </section>

      <section className="review-result-section">
        <div className="review-section-heading"><small>EDITORIAL DECISION</small><h2>편집결정</h2></div>
        {decisions.length ? <div className="decision-result-list">{decisions.map((decision) => <article key={`${decision.round_no}-${decision.decided_at}`}><div><strong>{DECISION_LABELS[decision.decision]}</strong><span>{decision.round_no}차 · {formatDate(decision.decided_at)}</span></div><p>{decision.author_letter}</p></article>)}</div> : <div className="empty-state"><strong>공개된 편집결정이 없습니다.</strong></div>}
      </section>

      <section className="author-response-section">
        <div><small>AUTHOR RESPONSE</small><h2>심사답변 및 수정원고</h2><p>심사의견을 반영한 익명화 수정원고를 제출하면 다음 심사 단계로 접수됩니다.</p></div>
        {manuscript.status === "REVISION_REQUESTED" ? <button className="button button-primary" type="button" onClick={() => setShowRevision(true)}>수정원고 제출 <span>→</span></button> : <span className="response-status">현재 상태: {STATUS_LABELS[manuscript.status]}</span>}
      </section>
      {message && <p className="form-message" role="status">{message}</p>}
    </div>
    {showRevision && <FileSubmissionModal manuscript={manuscript} mode="revision" onClose={() => setShowRevision(false)} onComplete={loadResult} />}
  </section>;
}
