"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RECOMMENDATION_LABELS, STATUS_LABELS, formatDate, getErrorMessage, type Profile, type ReviewRecommendation } from "@/lib/journal";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getJournalFileUrl, uploadJournalFile } from "@/lib/supabase/files";

type ReviewerManuscript = {
  assignment_id: string;
  manuscript_id: string;
  manuscript_code: string | null;
  title_ko: string;
  title_en: string;
  abstract_ko: string;
  abstract_en: string;
  keywords_ko: string[];
  keywords_en: string[];
  research_field: string;
  manuscript_status: keyof typeof STATUS_LABELS;
  assignment_status: "INVITED" | "ACCEPTED" | "DECLINED" | "COMPLETED" | "CANCELLED";
  round_no: number;
  due_at: string;
  responded_at: string | null;
  review_status: "DRAFT" | "SUBMITTED" | null;
  recommendation: ReviewRecommendation | null;
  review_submitted_at: string | null;
};

type ReviewerFile = { file_id: string; bucket_id: string; storage_path: string; file_kind: string; version_no: number; mime_type: string; size_bytes: number; created_at: string };

export function ReviewerDashboard({ profile }: { profile: Profile }) {
  const [items, setItems] = useState<ReviewerManuscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [reviewTarget, setReviewTarget] = useState<ReviewerManuscript | null>(null);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getSupabaseClient().rpc("get_reviewer_manuscripts");
    if (error) setMessage(error.message);
    else setItems((data ?? []) as ReviewerManuscript[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAssignments(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAssignments]);

  async function respond(item: ReviewerManuscript, accept: boolean) {
    setMessage("");
    const reason = accept ? null : window.prompt("거절 사유를 입력해 주세요. 편집위원에게만 전달됩니다.") ?? "일정상 심사 곤란";
    const { error } = await getSupabaseClient().rpc("respond_to_review_assignment", {
      target_assignment_id: item.assignment_id,
      accept_assignment: accept,
      response_reason: reason ?? undefined,
    });
    if (error) setMessage(error.message); else await loadAssignments();
  }

  const counts = {
    invited: items.filter((item) => item.assignment_status === "INVITED").length,
    active: items.filter((item) => item.assignment_status === "ACCEPTED").length,
    completed: items.filter((item) => item.assignment_status === "COMPLETED").length,
    overdue: items.filter((item) => item.assignment_status === "ACCEPTED" && new Date(item.due_at) < new Date()).length,
  };

  return <div className="dashboard-stack">
    <section className="dashboard-hero reviewer-hero"><div><p>REVIEWER DASHBOARD</p><h1>{profile.full_name || "심사위원"}님의 심사업무</h1><span>익명화 원고와 배정된 심사만 열람할 수 있습니다.</span></div><div className="blind-badge"><i /><span>DOUBLE-BLIND<br /><b>저자정보 비공개</b></span></div></section>
    <section className="metric-grid"><Metric label="신규 의뢰" value={counts.invited} tone="alert" /><Metric label="심사 중" value={counts.active} /><Metric label="심사 완료" value={counts.completed} tone="success" /><Metric label="기한 초과" value={counts.overdue} tone="danger" /></section>
    {message && <div className="notice-box" role="status">{message}</div>}
    <section className="workspace-card"><div className="card-heading"><div><p>REVIEW ASSIGNMENTS</p><h2>배정 논문</h2></div><span>{items.length}건</span></div>
      {loading ? <div className="empty-state">심사 배정을 불러오는 중입니다.</div> : items.length === 0 ? <div className="empty-state"><strong>배정된 심사가 없습니다.</strong><p>새 심사의뢰가 도착하면 이 화면에 표시됩니다.</p></div> : <div className="review-card-list">
        {items.map((item) => <article className="review-assignment-card" key={item.assignment_id}>
          <div className="review-card-head"><span>{item.manuscript_code ?? "번호 발급 전"}</span><span className={`assignment-badge assignment-${item.assignment_status.toLowerCase()}`}>{assignmentLabel(item.assignment_status)}</span></div>
          <small>{item.research_field} · {item.round_no}차 심사</small><h3>{item.title_ko}</h3><p className="english-title">{item.title_en}</p>
          <div className="review-meta"><span>심사기한 <b>{formatDate(item.due_at)}</b></span><span>현재상태 <b>{STATUS_LABELS[item.manuscript_status]}</b></span>{item.recommendation && <span>제출판정 <b>{RECOMMENDATION_LABELS[item.recommendation]}</b></span>}</div>
          <div className="review-actions">
            {item.assignment_status === "INVITED" && <><button className="primary-small" type="button" onClick={() => void respond(item, true)}>심사의뢰 수락</button><button type="button" onClick={() => void respond(item, false)}>거절</button></>}
            {item.assignment_status === "ACCEPTED" && <button className="primary-small" type="button" onClick={() => setReviewTarget(item)}>원고열람·심사작성</button>}
            {item.assignment_status === "COMPLETED" && <button type="button" onClick={() => setReviewTarget(item)}>제출내역 확인</button>}
          </div>
        </article>)}
      </div>}
    </section>
    {reviewTarget && <ReviewModal item={reviewTarget} onClose={() => setReviewTarget(null)} onComplete={loadAssignments} />}
  </div>;
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: string }) {
  return <article className={`metric-card metric-${tone}`}><span>{label}</span><strong>{String(value).padStart(2, "0")}</strong><i /></article>;
}

function assignmentLabel(status: ReviewerManuscript["assignment_status"]) {
  return { INVITED: "수락대기", ACCEPTED: "심사중", DECLINED: "거절", COMPLETED: "심사완료", CANCELLED: "취소" }[status];
}

function ReviewModal({ item, onClose, onComplete }: { item: ReviewerManuscript; onClose: () => void; onComplete: () => Promise<void> }) {
  const [files, setFiles] = useState<ReviewerFile[]>([]);
  const [draft, setDraft] = useState({ recommendation: item.recommendation ?? "RE_REVIEW" as ReviewRecommendation, authorComments: "", editorComments: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = getSupabaseClient();
    void Promise.all([
      supabase.rpc("get_reviewer_files", { target_manuscript_id: item.manuscript_id }),
      supabase.from("reviews").select("recommendation,author_comments,editor_comments").eq("assignment_id", item.assignment_id).maybeSingle(),
    ]).then(([fileResult, reviewResult]) => {
      setFiles((fileResult.data ?? []) as ReviewerFile[]);
      if (reviewResult.data) setDraft({
        recommendation: reviewResult.data.recommendation ?? "RE_REVIEW",
        authorComments: reviewResult.data.author_comments,
        editorComments: reviewResult.data.editor_comments,
      });
    });
  }, [item.assignment_id, item.manuscript_id]);

  async function openFile(file: ReviewerFile) {
    try { window.open(await getJournalFileUrl(file.file_id), "_blank", "noopener,noreferrer"); }
    catch (error) { setMessage(getErrorMessage(error)); }
  }

  async function save(submit: boolean, attachment?: File) {
    setBusy(true); setMessage("");
    try {
      if (attachment?.size) await uploadJournalFile(attachment, item.manuscript_id, "REVIEW_ATTACHMENT", item.round_no);
      const supabase = getSupabaseClient();
      const { error } = submit
        ? await supabase.rpc("submit_review", {
          target_assignment_id: item.assignment_id,
          final_recommendation: draft.recommendation,
          final_author_comments: draft.authorComments,
          final_editor_comments: draft.editorComments,
        })
        : await supabase.rpc("save_review_draft", {
          target_assignment_id: item.assignment_id,
          draft_recommendation: draft.recommendation,
          draft_author_comments: draft.authorComments,
          draft_editor_comments: draft.editorComments,
        });
      if (error) throw error;
      setMessage(submit ? "심사결과를 제출했습니다." : "임시저장했습니다.");
      if (submit) { await onComplete(); setTimeout(onClose, 500); }
    } catch (error) { setMessage(getErrorMessage(error)); } finally { setBusy(false); }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const attachment = form.get("attachment");
    void save(true, attachment instanceof File ? attachment : undefined);
  }

  const readOnly = item.assignment_status === "COMPLETED";
  return <div className="modal-backdrop modal-scroll"><section className="review-modal" role="dialog" aria-modal="true"><button className="modal-close" type="button" onClick={onClose}>×</button>
    <p className="panel-eyebrow">DOUBLE-BLIND REVIEW · ROUND {item.round_no}</p><h2>{item.manuscript_code}</h2><h3>{item.title_ko}</h3><p className="english-title">{item.title_en}</p>
    <div className="blind-notice"><b>이중맹검 보호</b><span>이 화면에는 저자 이름, 이메일, 소속이 제공되지 않습니다.</span></div>
    <div className="abstract-grid"><article><span>국문초록</span><p>{item.abstract_ko}</p><small>{item.keywords_ko.join(" · ")}</small></article><article><span>ABSTRACT</span><p>{item.abstract_en}</p><small>{item.keywords_en.join(" · ")}</small></article></div>
    <div className="file-list"><h4>익명 원고</h4>{files.length ? files.map((file) => <button type="button" key={file.file_id} onClick={() => void openFile(file)}><span>{file.file_kind === "REVISION" ? `${file.version_no}차 수정원고` : "최초 익명원고"}</span><small>{(file.size_bytes / 1024 / 1024).toFixed(1)}MB · 60초 보안링크</small><b>열람 ↗</b></button>) : <p>열람 가능한 익명 원고가 없습니다.</p>}</div>
    <form className="stack-form review-form" onSubmit={handleSubmit}>
      <label>심사판정<select value={draft.recommendation} disabled={readOnly} onChange={(event) => setDraft({ ...draft, recommendation: event.target.value as ReviewRecommendation })}>{Object.entries(RECOMMENDATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>저자 공개용 심사의견<textarea rows={8} value={draft.authorComments} readOnly={readOnly} required onChange={(event) => setDraft({ ...draft, authorComments: event.target.value })} placeholder="저자가 수정에 활용할 수 있도록 구체적으로 작성해 주세요." /></label>
      <label>편집위원 전용 의견<textarea rows={5} value={draft.editorComments} readOnly={readOnly} onChange={(event) => setDraft({ ...draft, editorComments: event.target.value })} placeholder="저자에게 공개되지 않는 의견입니다." /></label>
      {!readOnly && <label>심사의견서 파일(선택)<input name="attachment" type="file" accept=".pdf,.doc,.docx,.txt" /></label>}
      {!readOnly && <div className="form-actions"><button className="secondary-button" type="button" disabled={busy} onClick={() => void save(false)}>임시저장</button><button className="button button-primary" disabled={busy}>{busy ? "처리 중…" : "심사결과 제출"}</button></div>}{message && <p className="form-message">{message}</p>}
    </form>
  </section></div>;
}
