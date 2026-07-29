"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  DECISION_LABELS,
  STATUS_LABELS,
  formatDate,
  getErrorMessage,
  type Manuscript,
  type ManuscriptStatus,
  type Profile,
} from "@/lib/journal";
import { getSupabaseClient } from "@/lib/supabase/client";
import { uploadJournalFile } from "@/lib/supabase/files";

type AuthorDecision = { decision: keyof typeof DECISION_LABELS; author_letter: string; round_no: number; decided_at: string };
type AuthorHistory = { from_status: keyof typeof STATUS_LABELS | null; to_status: keyof typeof STATUS_LABELS; note: string | null; changed_at: string };
type ManuscriptFilter = "all" | "received" | "review" | "revision" | "final" | "withdrawn";
const WITHDRAWABLE_STATUSES: ManuscriptStatus[] = [
  "SUBMITTED", "RECEIVED", "FORMAT_REVIEW", "REVIEWER_SELECTION", "UNDER_REVIEW",
  "REVISION_REQUESTED", "REVISION_SUBMITTED", "RE_REVIEW", "ACCEPTED", "ACCEPT_WITH_REVISIONS",
];

export function openAuthorReviewResult(manuscriptId: string) {
  const url = new URL(window.location.href);
  url.hash = `author-review-result?manuscript=${encodeURIComponent(manuscriptId)}`;
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

export function openNewSubmissionPage(draftId?: string) {
  const draftQuery = draftId ? `&draft=${encodeURIComponent(draftId)}` : "";
  window.location.hash = `online-submission?mode=new&step=ethics${draftQuery}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const FILTER_STATUSES: Record<Exclude<ManuscriptFilter, "all">, ManuscriptStatus[]> = {
  received: ["SUBMITTED", "RECEIVED", "FORMAT_REVIEW"],
  review: ["REVIEWER_SELECTION", "UNDER_REVIEW", "RE_REVIEW"],
  revision: ["REVISION_REQUESTED", "REVISION_SUBMITTED"],
  final: ["ACCEPTED", "ACCEPT_WITH_REVISIONS", "FINAL_ACCEPTED", "PUBLISHED"],
  withdrawn: ["WITHDRAWN"],
};

export function AuthorDashboard({ profile }: { profile: Profile }) {
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ManuscriptFilter>("all");
  const [fileTarget, setFileTarget] = useState<{ manuscript: Manuscript; mode: "draft" | "revision" | "final" } | null>(null);
  const [withdrawalTarget, setWithdrawalTarget] = useState<Manuscript | null>(null);
  const [detail, setDetail] = useState<{ manuscript: Manuscript; decisions: AuthorDecision[]; history: AuthorHistory[] } | null>(null);

  const loadManuscripts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getSupabaseClient().from("manuscripts").select("*").order("created_at", { ascending: false });
    if (!error) setManuscripts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadManuscripts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadManuscripts]);

  async function openDetail(manuscript: Manuscript) {
    const supabase = getSupabaseClient();
    const [decisions, history] = await Promise.all([
      supabase.rpc("get_author_decisions", { target_manuscript_id: manuscript.id }),
      supabase.rpc("get_author_status_history", { target_manuscript_id: manuscript.id }),
    ]);
    setDetail({
      manuscript,
      decisions: (decisions.data ?? []) as AuthorDecision[],
      history: (history.data ?? []) as AuthorHistory[],
    });
  }

  const counts = {
    all: manuscripts.length,
    active: manuscripts.filter((item) => !["DRAFT", "REJECTED", "WITHDRAWN", "PUBLISHED"].includes(item.status)).length,
    revision: manuscripts.filter((item) => item.status === "REVISION_REQUESTED").length,
    accepted: manuscripts.filter((item) => ["ACCEPTED", "ACCEPT_WITH_REVISIONS", "FINAL_ACCEPTED", "PUBLISHED"].includes(item.status)).length,
  };
  const tasks = manuscripts.filter((item) => ["DRAFT", "REVISION_REQUESTED", "ACCEPTED", "ACCEPT_WITH_REVISIONS"].includes(item.status)).length;
  const filteredManuscripts = filter === "all" ? manuscripts : manuscripts.filter((item) => FILTER_STATUSES[filter].includes(item.status));
  const statusFilters: { id: ManuscriptFilter; label: string; count: number }[] = [
    { id: "all", label: "논문 총괄현황", count: counts.all },
    { id: "received", label: "논문 접수 현황", count: manuscripts.filter((item) => FILTER_STATUSES.received.includes(item.status)).length },
    { id: "review", label: "논문 심사 진행 현황", count: manuscripts.filter((item) => FILTER_STATUSES.review.includes(item.status)).length },
    { id: "revision", label: "수정 논문 제출 현황", count: manuscripts.filter((item) => FILTER_STATUSES.revision.includes(item.status)).length },
    { id: "final", label: "최종 논문 제출 현황", count: manuscripts.filter((item) => FILTER_STATUSES.final.includes(item.status)).length },
    { id: "withdrawn", label: "투고 철회 현황", count: manuscripts.filter((item) => FILTER_STATUSES.withdrawn.includes(item.status)).length },
  ];

  return (
    <div className="dashboard-stack">
      <section className="dashboard-hero">
        <div><p>MY PAGE · AUTHOR</p><h1>{profile.full_name || "저자"}님의 투고현황</h1><span>논문 진행상태와 편집결정을 한눈에 확인하세요.</span></div>
        <button className="button button-lime" type="button" onClick={() => openNewSubmissionPage()}>신규 논문 투고 <span>＋</span></button>
      </section>
      <section className="author-role-panel" aria-label="투고자 논문 관리 메뉴">
        <div className="author-role-tab"><span>유형 선택</span><strong>투고자</strong></div>
        <div className="author-task-count"><span>나의 할 일</span><strong>{tasks}</strong><small>건</small></div>
        <nav>
          {statusFilters.map((item) => (
            <button className={filter === item.id ? "active" : ""} type="button" onClick={() => setFilter(item.id)} key={item.id}>
              <span>{item.label}</span><strong>{item.count}</strong>
            </button>
          ))}
        </nav>
      </section>
      <section className="metric-grid" aria-label="투고현황 요약">
        <Metric label="전체 투고" value={counts.all} />
        <Metric label="진행 중" value={counts.active} />
        <Metric label="수정 요청" value={counts.revision} tone="alert" />
        <Metric label="게재 단계" value={counts.accepted} tone="success" />
      </section>
      <section className="workspace-card">
        <div className="card-heading"><div><p>MY MANUSCRIPTS</p><h2>내 투고논문</h2></div><span>{filteredManuscripts.length}건</span></div>
        {loading ? <div className="empty-state">투고현황을 불러오는 중입니다.</div> : manuscripts.length === 0 ? (
          <div className="empty-state"><strong>아직 투고한 논문이 없습니다.</strong><p>신규 논문 투고 버튼에서 첫 원고를 접수해 주세요.</p></div>
        ) : filteredManuscripts.length === 0 ? (
          <div className="empty-state"><strong>이 단계에 해당하는 논문이 없습니다.</strong><p>다른 진행단계를 선택해 투고현황을 확인해 주세요.</p></div>
        ) : (
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>논문번호</th><th>논문제목</th><th>투고일</th><th>현재상태</th><th>업무</th></tr></thead><tbody>
            {filteredManuscripts.map((manuscript) => (
              <tr key={manuscript.id}>
                <td><b>{manuscript.manuscript_code ?? "임시저장"}</b></td>
                <td><button className="table-title" type="button" onClick={() => void openDetail(manuscript)}>{manuscript.title_ko || "제목 미입력"}</button><small>{manuscript.title_en}</small></td>
                <td>{formatDate(manuscript.submitted_at ?? manuscript.created_at)}</td>
                <td><span className={`status-badge status-${manuscript.status.toLowerCase()}`}>{STATUS_LABELS[manuscript.status]}</span></td>
                <td><div className="table-actions">
                  {manuscript.status === "DRAFT" && <button type="button" onClick={() => openNewSubmissionPage(manuscript.id)}>작성 이어가기</button>}
                  {manuscript.status === "REVISION_REQUESTED" && <button type="button" onClick={() => setFileTarget({ manuscript, mode: "revision" })}>수정원고 제출</button>}
                  {["ACCEPTED", "ACCEPT_WITH_REVISIONS"].includes(manuscript.status) && <button type="button" onClick={() => setFileTarget({ manuscript, mode: "final" })}>최종원고 제출</button>}
                  {!["DRAFT", "SUBMITTED", "RECEIVED", "FORMAT_REVIEW", "REVIEWER_SELECTION", "WITHDRAWN"].includes(manuscript.status) && <button type="button" onClick={() => openAuthorReviewResult(manuscript.id)}>결과</button>}
                  {WITHDRAWABLE_STATUSES.includes(manuscript.status) && <button className="withdraw-manuscript-button" type="button" onClick={() => setWithdrawalTarget(manuscript)}>투고 철회</button>}
                  <button type="button" onClick={() => void openDetail(manuscript)}>이력 보기</button>
                </div></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
      {fileTarget && <FileSubmissionModal {...fileTarget} onClose={() => setFileTarget(null)} onComplete={loadManuscripts} />}
      {withdrawalTarget && <WithdrawalModal manuscript={withdrawalTarget} onClose={() => setWithdrawalTarget(null)} onComplete={loadManuscripts} />}
      {detail && <AuthorDetailModal {...detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function WithdrawalModal({ manuscript, onClose, onComplete }: { manuscript: Manuscript; onClose: () => void; onComplete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (reason.length < 5) { setMessage("철회 사유를 5자 이상 입력해 주세요."); return; }
    setBusy(true); setMessage("");
    try {
      const { error } = await getSupabaseClient().rpc("withdraw_manuscript", { target_manuscript_id: manuscript.id, reason });
      if (error) throw error;
      await onComplete();
      onClose();
    } catch (error) {
      const rawMessage = getErrorMessage(error);
      setMessage(/not allowed in the current status/i.test(rawMessage) ? "현재 단계에서는 투고를 철회할 수 없습니다." : rawMessage);
    } finally { setBusy(false); }
  }

  return <div className="modal-backdrop"><section className="auth-panel withdrawal-modal" role="dialog" aria-modal="true" aria-labelledby="withdrawal-title"><button className="modal-close" type="button" onClick={onClose}>×</button><p className="panel-eyebrow">MANUSCRIPT WITHDRAWAL</p><h2 id="withdrawal-title">투고 철회</h2><p className="panel-description">{manuscript.manuscript_code} · {manuscript.title_ko}</p>
    <div className="withdrawal-warning"><strong>철회 후에는 되돌릴 수 없습니다.</strong><p>원고와 처리 이력은 기록보존을 위해 삭제되지 않으며, 진행 중인 심사 배정은 자동으로 취소됩니다.</p></div>
    <form className="stack-form" onSubmit={withdraw}><label>철회 사유<textarea name="reason" rows={5} minLength={5} required placeholder="편집위원회가 확인할 수 있도록 철회 사유를 입력해 주세요." /></label><div className="form-actions"><button className="secondary-button" type="button" disabled={busy} onClick={onClose}>취소</button><button className="danger-button" disabled={busy}>{busy ? "철회 처리 중…" : "투고 철회 확정"}</button></div>{message && <p className="form-message" role="status">{message}</p>}</form>
  </section></div>;
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: string }) {
  return <article className={`metric-card metric-${tone}`}><span>{label}</span><strong>{String(value).padStart(2, "0")}</strong><i /></article>;
}

export function FileSubmissionModal({ manuscript, mode, onClose, onComplete }: { manuscript: Manuscript; mode: "draft" | "revision" | "final"; onClose: () => void; onComplete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const title = mode === "draft" ? "임시원고 제출 완료" : mode === "revision" ? "수정원고 제출" : "최종원고 제출";
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      if (mode === "draft") {
        const original = form.get("original"); const anonymized = form.get("anonymized");
        if (!(original instanceof File) || !original.size || !(anonymized instanceof File) || !anonymized.size) throw new Error("두 파일을 모두 선택해 주세요.");
        await uploadJournalFile(original, manuscript.id, "ORIGINAL", 1);
        await uploadJournalFile(anonymized, manuscript.id, "ANONYMIZED", 1);
        const { error } = await getSupabaseClient().rpc("submit_manuscript", { target_manuscript_id: manuscript.id }); if (error) throw error;
      } else {
        const file = form.get("file"); if (!(file instanceof File) || !file.size) throw new Error("파일을 선택해 주세요.");
        if (mode === "revision") {
          await uploadJournalFile(file, manuscript.id, "REVISION", manuscript.round_no + 1);
          const { error } = await getSupabaseClient().rpc("submit_revision", { target_manuscript_id: manuscript.id }); if (error) throw error;
        } else {
          await uploadJournalFile(file, manuscript.id, "FINAL", Math.max(manuscript.round_no, 1));
        }
      }
      await onComplete(); onClose();
    } catch (error) { setMessage(getErrorMessage(error)); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop"><section className="auth-panel file-modal" role="dialog" aria-modal="true"><button className="modal-close" type="button" onClick={onClose}>×</button><p className="panel-eyebrow">MANUSCRIPT FILE</p><h2>{title}</h2><p className="panel-description">{manuscript.manuscript_code ?? "임시저장"} · {manuscript.title_ko}</p><form className="stack-form" onSubmit={handleSubmit}>
    {mode === "draft" ? <><label>원고파일<input name="original" type="file" required /></label><label>익명화 원고<input name="anonymized" type="file" required /></label></> : <label>{mode === "revision" ? "익명화 수정원고" : "최종 편집원고"}<input name="file" type="file" required /></label>}
    <button className="button button-primary" disabled={busy}>{busy ? "업로드 중…" : "제출"}</button>{message && <p className="form-message">{message}</p>}
  </form></section></div>;
}

function AuthorDetailModal({ manuscript, decisions, history, onClose }: { manuscript: Manuscript; decisions: AuthorDecision[]; history: AuthorHistory[]; onClose: () => void }) {
  return <div className="modal-backdrop modal-scroll"><section className="detail-modal" role="dialog" aria-modal="true"><button className="modal-close" type="button" onClick={onClose}>×</button><p className="panel-eyebrow">MANUSCRIPT HISTORY</p><h2>{manuscript.manuscript_code ?? "임시저장"}</h2><h3>{manuscript.title_ko}</h3>
    {manuscript.status === "WITHDRAWN" && <div className="withdrawal-record"><strong>투고 철회 완료 · {formatDate(manuscript.withdrawn_at)}</strong><p>{manuscript.withdrawal_reason}</p></div>}
    <div className="detail-columns"><div><h4>편집결정</h4>{decisions.length ? decisions.map((item) => <article className="decision-card" key={`${item.decided_at}-${item.round_no}`}><span>{DECISION_LABELS[item.decision]} · {item.round_no}차</span><p>{item.author_letter}</p><small>{formatDate(item.decided_at)}</small></article>) : <p className="muted-text">공개된 편집결정이 없습니다.</p>}</div>
    <div><h4>상태 변경이력</h4><ol className="timeline">{history.map((item, index) => <li key={`${item.changed_at}-${index}`}><i /><div><strong>{STATUS_LABELS[item.to_status]}</strong><span>{formatDate(item.changed_at)}</span>{item.note && <p>{item.note}</p>}</div></li>)}</ol></div></div>
  </section></div>;
}
