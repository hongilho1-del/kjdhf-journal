"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  DECISION_LABELS,
  STATUS_LABELS,
  formatDate,
  getErrorMessage,
  splitKeywords,
  type Manuscript,
  type Profile,
} from "@/lib/journal";
import { getSupabaseClient } from "@/lib/supabase/client";
import { uploadJournalFile } from "@/lib/supabase/files";

type Coauthor = { nameKo: string; nameEn: string; affiliationKo: string; affiliationEn: string; email: string };
type AuthorDecision = { decision: keyof typeof DECISION_LABELS; author_letter: string; round_no: number; decided_at: string };
type AuthorHistory = { from_status: keyof typeof STATUS_LABELS | null; to_status: keyof typeof STATUS_LABELS; note: string | null; changed_at: string };

export function AuthorDashboard({ profile }: { profile: Profile }) {
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmission, setShowSubmission] = useState(false);
  const [fileTarget, setFileTarget] = useState<{ manuscript: Manuscript; mode: "draft" | "revision" | "final" } | null>(null);
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
    active: manuscripts.filter((item) => !["DRAFT", "REJECTED", "PUBLISHED"].includes(item.status)).length,
    revision: manuscripts.filter((item) => item.status === "REVISION_REQUESTED").length,
    accepted: manuscripts.filter((item) => ["ACCEPTED", "ACCEPT_WITH_REVISIONS", "FINAL_ACCEPTED", "PUBLISHED"].includes(item.status)).length,
  };

  return (
    <div className="dashboard-stack">
      <section className="dashboard-hero">
        <div><p>AUTHOR DASHBOARD</p><h1>{profile.full_name || "저자"}님의 투고현황</h1><span>논문 진행상태와 편집결정을 한눈에 확인하세요.</span></div>
        <button className="button button-lime" type="button" onClick={() => setShowSubmission(true)}>신규 논문 투고 <span>＋</span></button>
      </section>
      <section className="metric-grid" aria-label="투고현황 요약">
        <Metric label="전체 투고" value={counts.all} />
        <Metric label="진행 중" value={counts.active} />
        <Metric label="수정 요청" value={counts.revision} tone="alert" />
        <Metric label="게재 단계" value={counts.accepted} tone="success" />
      </section>
      <section className="workspace-card">
        <div className="card-heading"><div><p>MY MANUSCRIPTS</p><h2>내 투고논문</h2></div><span>{manuscripts.length}건</span></div>
        {loading ? <div className="empty-state">투고현황을 불러오는 중입니다.</div> : manuscripts.length === 0 ? (
          <div className="empty-state"><strong>아직 투고한 논문이 없습니다.</strong><p>신규 논문 투고 버튼에서 첫 원고를 접수해 주세요.</p></div>
        ) : (
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>논문번호</th><th>논문제목</th><th>투고일</th><th>현재상태</th><th>업무</th></tr></thead><tbody>
            {manuscripts.map((manuscript) => (
              <tr key={manuscript.id}>
                <td><b>{manuscript.manuscript_code ?? "임시저장"}</b></td>
                <td><button className="table-title" type="button" onClick={() => void openDetail(manuscript)}>{manuscript.title_ko}</button><small>{manuscript.title_en}</small></td>
                <td>{formatDate(manuscript.submitted_at ?? manuscript.created_at)}</td>
                <td><span className={`status-badge status-${manuscript.status.toLowerCase()}`}>{STATUS_LABELS[manuscript.status]}</span></td>
                <td><div className="table-actions">
                  {manuscript.status === "DRAFT" && <button type="button" onClick={() => setFileTarget({ manuscript, mode: "draft" })}>파일 추가·제출</button>}
                  {manuscript.status === "REVISION_REQUESTED" && <button type="button" onClick={() => setFileTarget({ manuscript, mode: "revision" })}>수정원고 제출</button>}
                  {["ACCEPTED", "ACCEPT_WITH_REVISIONS"].includes(manuscript.status) && <button type="button" onClick={() => setFileTarget({ manuscript, mode: "final" })}>최종원고 제출</button>}
                  <button type="button" onClick={() => void openDetail(manuscript)}>이력 보기</button>
                </div></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
      {showSubmission && <SubmissionModal profile={profile} onClose={() => setShowSubmission(false)} onComplete={loadManuscripts} />}
      {fileTarget && <FileSubmissionModal {...fileTarget} onClose={() => setFileTarget(null)} onComplete={loadManuscripts} />}
      {detail && <AuthorDetailModal {...detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: string }) {
  return <article className={`metric-card metric-${tone}`}><span>{label}</span><strong>{String(value).padStart(2, "0")}</strong><i /></article>;
}

function SubmissionModal({ profile, onClose, onComplete }: { profile: Profile; onClose: () => void; onComplete: () => Promise<void> }) {
  const [coauthors, setCoauthors] = useState<Coauthor[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const original = values.get("originalFile");
    const anonymized = values.get("anonymizedFile");
    if (!(original instanceof File) || !original.size || !(anonymized instanceof File) || !anonymized.size) {
      setMessage("원고파일과 익명화 원고를 모두 선택해 주세요.");
      return;
    }
    setBusy(true);
    setMessage("논문 정보를 저장하고 있습니다…");
    try {
      const supabase = getSupabaseClient();
      const { data: manuscript, error: manuscriptError } = await supabase.from("manuscripts").insert({
        title_ko: String(values.get("titleKo")),
        title_en: String(values.get("titleEn")),
        abstract_ko: String(values.get("abstractKo")),
        abstract_en: String(values.get("abstractEn")),
        keywords_ko: splitKeywords(String(values.get("keywordsKo"))),
        keywords_en: splitKeywords(String(values.get("keywordsEn"))),
        research_field: String(values.get("researchField")),
        ethics_confirmed: values.get("ethics") === "on",
        conflict_of_interest_confirmed: values.get("conflict") === "on",
        copyright_agreed: values.get("copyright") === "on",
      }).select().single();
      if (manuscriptError) throw manuscriptError;

      const corresponding = {
        manuscript_id: manuscript.id,
        user_id: profile.id,
        name_ko: String(values.get("correspondingName")),
        name_en: String(values.get("correspondingNameEn") || "") || null,
        affiliation_ko: String(values.get("affiliation")),
        affiliation_en: String(values.get("affiliationEn") || "") || null,
        email: String(values.get("correspondingEmail")),
        is_corresponding: true,
        sort_order: 1,
      };
      const authorRows = [corresponding, ...coauthors.map((author, index) => ({
        manuscript_id: manuscript.id,
        user_id: null,
        name_ko: author.nameKo,
        name_en: author.nameEn || null,
        affiliation_ko: author.affiliationKo,
        affiliation_en: author.affiliationEn || null,
        email: author.email,
        is_corresponding: false,
        sort_order: index + 2,
      }))];
      const { error: authorError } = await supabase.from("authors").insert(authorRows);
      if (authorError) throw authorError;

      setMessage("원고파일을 안전하게 업로드하고 있습니다…");
      await uploadJournalFile(original, manuscript.id, "ORIGINAL", 1);
      await uploadJournalFile(anonymized, manuscript.id, "ANONYMIZED", 1);
      const { error: submitError } = await supabase.rpc("submit_manuscript", { target_manuscript_id: manuscript.id });
      if (submitError) throw submitError;
      await onComplete();
      onClose();
    } catch (error) {
      setMessage(`${getErrorMessage(error)} 임시저장 원고는 대시보드에서 이어서 제출할 수 있습니다.`);
      await onComplete();
    } finally {
      setBusy(false);
    }
  }

  function updateCoauthor(index: number, key: keyof Coauthor, value: string) {
    setCoauthors((current) => current.map((author, authorIndex) => authorIndex === index ? { ...author, [key]: value } : author));
  }

  return (
    <div className="modal-backdrop modal-scroll"><section className="submission-modal" role="dialog" aria-modal="true" aria-labelledby="submission-title">
      <button className="modal-close" type="button" onClick={onClose} disabled={busy}>×</button>
      <p className="panel-eyebrow">NEW SUBMISSION</p><h2 id="submission-title">신규 논문 투고</h2>
      <p className="panel-description">저자정보와 익명 원고는 분리 저장됩니다. 원고 본문에서 저자를 식별할 수 있는 내용을 제거해 주세요.</p>
      <form className="form-grid submission-form" onSubmit={handleSubmit}>
        <h3 className="form-section-title wide"><span>01</span> 논문 기본정보</h3>
        <label className="wide">논문제목(국문)<input name="titleKo" required /></label>
        <label className="wide">논문제목(영문)<input name="titleEn" required /></label>
        <label className="wide">국문초록<textarea name="abstractKo" rows={5} required /></label>
        <label className="wide">영문초록<textarea name="abstractEn" rows={5} required /></label>
        <label>국문 핵심어<input name="keywordsKo" placeholder="쉼표로 구분" required /></label>
        <label>영문 Keywords<input name="keywordsEn" placeholder="Comma separated" required /></label>
        <label className="wide">연구분야<select name="researchField" required defaultValue=""><option value="" disabled>선택해 주세요</option><option>디지털 헬스</option><option>건강체력 측정·평가</option><option>운동생리학</option><option>운동처방·재활</option><option>학교·지역사회 건강</option><option>기타</option></select></label>

        <h3 className="form-section-title wide"><span>02</span> 교신저자·공동저자</h3>
        <label>교신저자 이름(국문)<input name="correspondingName" defaultValue={profile.full_name} required /></label>
        <label>교신저자 이름(영문)<input name="correspondingNameEn" /></label>
        <label>소속(국문)<input name="affiliation" defaultValue={profile.affiliation ?? ""} required /></label>
        <label>소속(영문)<input name="affiliationEn" /></label>
        <label className="wide">교신저자 이메일<input name="correspondingEmail" type="email" defaultValue={profile.email} required /></label>
        {coauthors.map((author, index) => <div className="coauthor-block wide" key={index}>
          <div><strong>공동저자 {index + 1}</strong><button type="button" onClick={() => setCoauthors((current) => current.filter((_, itemIndex) => itemIndex !== index))}>삭제</button></div>
          <label>이름(국문)<input value={author.nameKo} onChange={(event) => updateCoauthor(index, "nameKo", event.target.value)} required /></label>
          <label>이름(영문)<input value={author.nameEn} onChange={(event) => updateCoauthor(index, "nameEn", event.target.value)} /></label>
          <label>소속(국문)<input value={author.affiliationKo} onChange={(event) => updateCoauthor(index, "affiliationKo", event.target.value)} required /></label>
          <label>소속(영문)<input value={author.affiliationEn} onChange={(event) => updateCoauthor(index, "affiliationEn", event.target.value)} /></label>
          <label className="wide">이메일<input type="email" value={author.email} onChange={(event) => updateCoauthor(index, "email", event.target.value)} required /></label>
        </div>)}
        <button className="secondary-button wide add-author" type="button" onClick={() => setCoauthors((current) => [...current, { nameKo: "", nameEn: "", affiliationKo: "", affiliationEn: "", email: "" }])}>＋ 공동저자 추가</button>

        <h3 className="form-section-title wide"><span>03</span> 파일·동의</h3>
        <label>원고파일<input name="originalFile" type="file" accept=".pdf,.doc,.docx,.hwp" required /><small>저자정보가 포함된 편집용 원고</small></label>
        <label>익명화 원고<input name="anonymizedFile" type="file" accept=".pdf,.doc,.docx,.hwp" required /><small>심사위원에게 제공되는 비식별 원고</small></label>
        <div className="consent-list wide">
          <label><input name="ethics" type="checkbox" required /> 연구윤리 준수 및 중복투고 금지를 확인합니다.</label>
          <label><input name="conflict" type="checkbox" required /> 이해상충 여부를 확인하고 필요한 내용을 고지했습니다.</label>
          <label><input name="copyright" type="checkbox" required /> 게재 시 저작권 및 이용조건에 동의합니다.</label>
        </div>
        <div className="form-actions wide"><button className="button button-primary" disabled={busy}>{busy ? "투고 처리 중…" : "논문 투고 완료"}</button>{message && <span role="status">{message}</span>}</div>
      </form>
    </section></div>
  );
}

function FileSubmissionModal({ manuscript, mode, onClose, onComplete }: { manuscript: Manuscript; mode: "draft" | "revision" | "final"; onClose: () => void; onComplete: () => Promise<void> }) {
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
    <div className="detail-columns"><div><h4>편집결정</h4>{decisions.length ? decisions.map((item) => <article className="decision-card" key={`${item.decided_at}-${item.round_no}`}><span>{DECISION_LABELS[item.decision]} · {item.round_no}차</span><p>{item.author_letter}</p><small>{formatDate(item.decided_at)}</small></article>) : <p className="muted-text">공개된 편집결정이 없습니다.</p>}</div>
    <div><h4>상태 변경이력</h4><ol className="timeline">{history.map((item, index) => <li key={`${item.changed_at}-${index}`}><i /><div><strong>{STATUS_LABELS[item.to_status]}</strong><span>{formatDate(item.changed_at)}</span>{item.note && <p>{item.note}</p>}</div></li>)}</ol></div></div>
  </section></div>;
}
