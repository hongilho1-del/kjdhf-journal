"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { FileSubmissionModal, openAuthorReviewResult } from "@/components/author-dashboard";
import { STATUS_LABELS, formatDate, getErrorMessage, splitKeywords, type Manuscript, type Profile } from "@/lib/journal";
import { getSupabaseClient } from "@/lib/supabase/client";
import { uploadJournalFile } from "@/lib/supabase/files";

type SubmissionTab = "new" | "revision" | "final" | "status";
type WizardStep = 1 | 2 | 3 | 4;
type AuthorshipType = "SOLE" | "COAUTHORED";
type DraftAuthor = { nameKo: string; nameEn: string; affiliationKo: string; affiliationEn: string; email: string };
type PaperDraft = { titleKo: string; titleEn: string; abstractKo: string; abstractEn: string; keywordsKo: string; keywordsEn: string; researchField: string };

const EMPTY_AUTHOR: DraftAuthor = { nameKo: "", nameEn: "", affiliationKo: "", affiliationEn: "", email: "" };
const EMPTY_PAPER: PaperDraft = { titleKo: "", titleEn: "", abstractKo: "", abstractEn: "", keywordsKo: "", keywordsEn: "", researchField: "" };
const STEP_LABELS = ["연구윤리서약", "논문·초록 입력", "저자정보", "원고파일"];
const STEP_HASHES = ["ethics", "abstract", "authors", "files"];

const TAB_COPY: Record<SubmissionTab, { title: string; description: string }> = {
  new: { title: "신규논문제출", description: "연구윤리 서약부터 원고파일 제출까지 단계별로 진행합니다." },
  revision: { title: "수정논문제출", description: "심사의견을 확인한 뒤 익명화된 수정원고를 제출합니다." },
  final: { title: "최종논문제출", description: "게재 판정을 받은 논문의 최종 편집원고를 제출합니다." },
  status: { title: "내논문심사현황", description: "투고 논문의 현재 상태와 공개된 심사결과를 확인합니다." },
};

export function ManuscriptSubmissionPage({ profile, onMyPage }: { profile: Profile; onMyPage: () => void }) {
  const [tab, setTab] = useState<SubmissionTab>("new");
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewSubmission, setShowNewSubmission] = useState(() => typeof window !== "undefined" && window.location.hash.includes("mode=new"));
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

  function openNewSubmission() {
    window.history.pushState(null, "", "#online-submission?mode=new&step=ethics");
    setShowNewSubmission(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeNewSubmission() {
    window.history.pushState(null, "", "#online-submission");
    setShowNewSubmission(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (profile.role !== "AUTHOR") return <div className="submission-access-card"><small>ONLINE SUBMISSION</small><h2>투고자 전용 메뉴입니다.</h2><p>현재 계정은 {profile.role === "REVIEWER" ? "심사위원" : "편집 업무"} 권한으로 로그인되어 있습니다. 역할별 업무는 My Page에서 이용해 주세요.</p><button className="button button-primary" type="button" onClick={onMyPage}>My Page로 이동</button></div>;

  if (showNewSubmission) return <NewSubmissionWizard profile={profile} onCancel={closeNewSubmission} onMyPage={onMyPage} onComplete={loadManuscripts} />;

  return <div className="submission-center">
    <section className="submission-center-hero"><div><small>ONLINE MANUSCRIPT SUBMISSION</small><h1>온라인 논문 투고</h1><p>한국 디지털 건강체력학회지 논문 제출과 진행상태를 관리합니다.</p></div><button type="button" onClick={onMyPage}>My Page <span>→</span></button></section>
    <nav className="submission-center-tabs" aria-label="논문 제출 메뉴">
      {(Object.keys(TAB_COPY) as SubmissionTab[]).map((id) => <button className={tab === id ? "active" : ""} type="button" onClick={() => setTab(id)} key={id}><strong>{TAB_COPY[id].title}</strong><span>→</span></button>)}
    </nav>
    <div className="submission-center-body">
      <section className="submission-main-card">
        <div className="submission-section-title"><small>AUTHOR SERVICE</small><h2>{TAB_COPY[tab].title}</h2><p>{TAB_COPY[tab].description}</p></div>
        {tab === "new" ? <div className="new-submission-guide">
          <ol><li><span>01</span><div><strong>연구윤리 및 저자 동의</strong><p>모든 저자의 연구윤리 준수와 저자표시 동의를 먼저 확인합니다.</p></div></li><li><span>02</span><div><strong>논문·초록 입력</strong><p>국·영문 제목과 초록, 핵심어, 연구분야를 입력합니다.</p></div></li><li><span>03</span><div><strong>저자·원고 등록</strong><p>단독·공동저자를 구분하고 교신저자를 지정한 뒤 원고를 제출합니다.</p></div></li></ol>
          <button className="button button-primary" type="button" onClick={openNewSubmission}>신규 논문 등록 시작 <span>→</span></button>
          <p className="submission-note">새 화면에서 단계별로 입력하며, 제출 전까지 이전 단계로 돌아가 내용을 확인할 수 있습니다.</p>
        </div> : <SubmissionList tab={tab} manuscripts={visible} loading={loading} onFile={(manuscript, mode) => setFileTarget({ manuscript, mode })} />}
      </section>
      <aside className="submission-side">
        <article><small>BEFORE SUBMISSION</small><h3>논문 유사도 확인</h3><p>투고 전 KCI 논문 유사도 검사 결과를 확인해 주세요.</p><a href="https://check.kci.go.kr/" target="_blank" rel="noreferrer">KCI 논문 유사도 서비스 <span>↗</span></a></article>
        <article><small>DOUBLE-BLIND REVIEW</small><h3>익명화 원고 안내</h3><p>저자명, 소속, 감사의 글 등 저자를 식별할 수 있는 정보를 익명 원고에서 반드시 제거해 주세요.</p></article>
      </aside>
    </div>
    {fileTarget && <FileSubmissionModal {...fileTarget} onClose={() => setFileTarget(null)} onComplete={loadManuscripts} />}
  </div>;
}

function NewSubmissionWizard({ profile, onCancel, onMyPage, onComplete }: { profile: Profile; onCancel: () => void; onMyPage: () => void; onComplete: () => Promise<void> }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [authorship, setAuthorship] = useState<AuthorshipType>("SOLE");
  const [ethics, setEthics] = useState({ authorship: false, integrity: false, originality: false, conflict: false });
  const [paper, setPaper] = useState<PaperDraft>(EMPTY_PAPER);
  const [authors, setAuthors] = useState<DraftAuthor[]>([{ ...EMPTY_AUTHOR, nameKo: profile.full_name, affiliationKo: profile.affiliation ?? "", email: profile.email }]);
  const [correspondingIndex, setCorrespondingIndex] = useState(0);
  const [copyrightAgreed, setCopyrightAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [completedCode, setCompletedCode] = useState("");
  const ethicsComplete = Object.values(ethics).every(Boolean);

  function goToStep(next: WizardStep) {
    setStep(next);
    window.history.replaceState(null, "", `#online-submission?mode=new&step=${STEP_HASHES[next - 1]}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectAuthorship(next: AuthorshipType) {
    setAuthorship(next);
    setCorrespondingIndex(0);
    setAuthors((current) => next === "SOLE" ? [current[0]] : current.length > 1 ? current : [current[0], { ...EMPTY_AUTHOR }]);
  }

  function updatePaper(key: keyof PaperDraft, value: string) {
    setPaper((current) => ({ ...current, [key]: value }));
  }

  function updateAuthor(index: number, key: keyof DraftAuthor, value: string) {
    setAuthors((current) => current.map((author, authorIndex) => authorIndex === index ? { ...author, [key]: value } : author));
  }

  function removeAuthor(index: number) {
    setAuthors((current) => current.filter((_, authorIndex) => authorIndex !== index));
    setCorrespondingIndex((current) => current === index ? 0 : current > index ? current - 1 : current);
  }

  async function handleFinalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const original = values.get("originalFile");
    const anonymized = values.get("anonymizedFile");
    if (!(original instanceof File) || !original.size || !(anonymized instanceof File) || !anonymized.size) {
      setMessage("원고파일과 익명화 원고를 모두 선택해 주세요.");
      return;
    }
    if (!copyrightAgreed) {
      setMessage("저작권 및 이용조건에 동의해 주세요.");
      return;
    }
    setBusy(true);
    setMessage("논문 정보를 저장하고 있습니다…");
    try {
      const supabase = getSupabaseClient();
      const { data: manuscript, error: manuscriptError } = await supabase.from("manuscripts").insert({
        title_ko: paper.titleKo,
        title_en: paper.titleEn,
        abstract_ko: paper.abstractKo,
        abstract_en: paper.abstractEn,
        keywords_ko: splitKeywords(paper.keywordsKo),
        keywords_en: splitKeywords(paper.keywordsEn),
        research_field: paper.researchField,
        ethics_confirmed: true,
        conflict_of_interest_confirmed: true,
        copyright_agreed: true,
      }).select().single();
      if (manuscriptError) throw manuscriptError;

      const authorRows = authors.map((author, index) => ({
        manuscript_id: manuscript.id,
        user_id: index === 0 ? profile.id : null,
        name_ko: author.nameKo,
        name_en: author.nameEn || null,
        affiliation_ko: author.affiliationKo,
        affiliation_en: author.affiliationEn || null,
        email: author.email,
        is_corresponding: index === correspondingIndex,
        sort_order: index + 1,
      }));
      const { error: authorError } = await supabase.from("authors").insert(authorRows);
      if (authorError) throw authorError;

      setMessage("원고파일을 안전하게 업로드하고 있습니다…");
      await uploadJournalFile(original, manuscript.id, "ORIGINAL", 1);
      await uploadJournalFile(anonymized, manuscript.id, "ANONYMIZED", 1);
      const { error: submitError } = await supabase.rpc("submit_manuscript", { target_manuscript_id: manuscript.id });
      if (submitError) throw submitError;
      const { data: submitted } = await supabase.from("manuscripts").select("manuscript_code").eq("id", manuscript.id).single();
      setCompletedCode(submitted?.manuscript_code ?? "접수 완료");
      await onComplete();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage(`${getErrorMessage(error)} 저장된 임시원고가 있다면 My Page에서 이어서 제출할 수 있습니다.`);
      await onComplete();
    } finally {
      setBusy(false);
    }
  }

  if (completedCode) return <div className="new-submission-page"><section className="wizard-complete"><small>SUBMISSION COMPLETE</small><div>✓</div><h1>논문 투고가 완료되었습니다.</h1><p>논문번호 <strong>{completedCode}</strong>로 접수되었습니다. My Page에서 심사 진행상태를 확인할 수 있습니다.</p><button className="button button-primary" type="button" onClick={onMyPage}>My Page에서 확인 <span>→</span></button></section></div>;

  return <div className="new-submission-page">
    <div className="new-submission-top"><button type="button" onClick={onCancel}>← 온라인 논문 투고로 돌아가기</button><span>작성 중인 내용은 최종 제출 전까지 서버에 저장되지 않습니다.</span></div>
    <header className="new-submission-header"><small>NEW MANUSCRIPT SUBMISSION</small><h1>신규 논문 투고</h1><p>연구윤리 확인부터 원고 제출까지 순서대로 진행해 주세요.</p></header>
    <ol className="manuscript-progress" aria-label="신규 논문 투고 단계">
      {STEP_LABELS.map((label, index) => <li className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></li>)}
    </ol>

    {step === 1 && <section className="wizard-panel">
      <div className="wizard-heading"><small>STEP 01</small><h2>연구윤리 및 저자 동의</h2><p>투고 책임자는 모든 저자에게 아래 내용을 공유하고 동의를 받은 후 진행해야 합니다.</p></div>
      <div className="ethics-notice"><strong>투고 전 확인</strong><p>본 확인은 단순한 안내가 아니라 모든 저자를 대표한 공식 서약입니다. 사실과 다른 확인으로 발생하는 책임은 투고자와 저자에게 있습니다.</p></div>
      <fieldset className="authorship-choice"><legend>저자 구성 선택</legend>
        <button className={authorship === "SOLE" ? "active" : ""} type="button" onClick={() => selectAuthorship("SOLE")}><span>01</span><strong>단독저자</strong><small>투고자 1인이 단독으로 작성한 논문</small></button>
        <button className={authorship === "COAUTHORED" ? "active" : ""} type="button" onClick={() => selectAuthorship("COAUTHORED")}><span>02</span><strong>공동저자</strong><small>2인 이상의 저자가 함께 작성한 논문</small></button>
      </fieldset>
      <div className="ethics-checklist">
        <label><input type="checkbox" checked={ethics.authorship} onChange={(event) => setEthics((current) => ({ ...current, authorship: event.target.checked }))} /><span><strong>저자 자격 및 저자표시 동의</strong>모든 저자가 연구에 실질적으로 참여했으며 저자 순서와 교신저자 지정에 동의했습니다.</span></label>
        <label><input type="checkbox" checked={ethics.integrity} onChange={(event) => setEthics((current) => ({ ...current, integrity: event.target.checked }))} /><span><strong>연구 진실성 확인</strong>위조·변조·표절 및 부당한 저자표시가 없으며 연구윤리 규정을 준수했습니다.</span></label>
        <label><input type="checkbox" checked={ethics.originality} onChange={(event) => setEthics((current) => ({ ...current, originality: event.target.checked }))} /><span><strong>중복·동시투고 금지 확인</strong>본 논문은 다른 학술지에 게재되었거나 현재 심사 중인 논문이 아닙니다.</span></label>
        <label><input type="checkbox" checked={ethics.conflict} onChange={(event) => setEthics((current) => ({ ...current, conflict: event.target.checked }))} /><span><strong>이해상충 공개 확인</strong>연구와 관련된 재정적·개인적 이해상충을 모든 저자가 확인하고 필요한 내용을 공개했습니다.</span></label>
      </div>
      <div className="wizard-actions"><button className="button button-primary" type="button" disabled={!ethicsComplete} onClick={() => goToStep(2)}>동의하고 논문정보 입력 <span>→</span></button></div>
    </section>}

    {step === 2 && <section className="wizard-panel">
      <div className="wizard-heading"><small>STEP 02</small><h2>논문 및 초록 입력</h2><p>심사와 색인에 사용될 국·영문 정보를 정확하게 입력해 주세요.</p></div>
      <form className="wizard-form" onSubmit={(event) => { event.preventDefault(); goToStep(3); }}>
        <label className="wide">논문제목(국문)<input value={paper.titleKo} onChange={(event) => updatePaper("titleKo", event.target.value)} required /></label>
        <label className="wide">논문제목(영문)<input value={paper.titleEn} onChange={(event) => updatePaper("titleEn", event.target.value)} required /></label>
        <label className="wide">국문초록<textarea rows={7} value={paper.abstractKo} onChange={(event) => updatePaper("abstractKo", event.target.value)} required /></label>
        <label className="wide">영문초록<textarea rows={7} value={paper.abstractEn} onChange={(event) => updatePaper("abstractEn", event.target.value)} required /></label>
        <label>국문 핵심어<input value={paper.keywordsKo} onChange={(event) => updatePaper("keywordsKo", event.target.value)} placeholder="쉼표로 구분" required /></label>
        <label>영문 Keywords<input value={paper.keywordsEn} onChange={(event) => updatePaper("keywordsEn", event.target.value)} placeholder="Comma separated" required /></label>
        <label className="wide">연구분야<select value={paper.researchField} onChange={(event) => updatePaper("researchField", event.target.value)} required><option value="" disabled>선택해 주세요</option><option>디지털 헬스</option><option>건강체력 측정·평가</option><option>운동생리학</option><option>운동처방·재활</option><option>학교·지역사회 건강</option><option>기타</option></select></label>
        <div className="wizard-actions wide"><button className="secondary-button" type="button" onClick={() => goToStep(1)}>← 이전</button><button className="button button-primary">저자정보 입력 <span>→</span></button></div>
      </form>
    </section>}

    {step === 3 && <section className="wizard-panel">
      <div className="wizard-heading"><small>STEP 03</small><h2>{authorship === "SOLE" ? "단독저자 및 교신저자 확인" : "공동저자 및 교신저자 지정"}</h2><p>{authorship === "SOLE" ? "단독저자는 투고자 본인이 교신저자로 자동 지정됩니다." : "저자를 논문 표기 순서대로 입력하고 교신저자 1명을 선택해 주세요."}</p></div>
      <form className="author-editor-list" onSubmit={(event) => { event.preventDefault(); goToStep(4); }}>
        {authors.map((author, index) => <article className="author-editor-card" key={index}>
          <header><div><span>{String(index + 1).padStart(2, "0")}</span><strong>{index === 0 ? "투고자" : `공동저자 ${index}`}</strong></div>{authorship === "COAUTHORED" && index > 0 && <button type="button" onClick={() => removeAuthor(index)}>저자 삭제</button>}</header>
          <label className="corresponding-choice"><input type="radio" name="correspondingAuthor" checked={correspondingIndex === index} onChange={() => setCorrespondingIndex(index)} /><span><strong>교신저자로 지정</strong>편집위원회와 연락하고 논문을 최종 확인할 저자입니다.</span></label>
          <div className="wizard-form">
            <label>이름(국문)<input value={author.nameKo} onChange={(event) => updateAuthor(index, "nameKo", event.target.value)} required /></label>
            <label>이름(영문)<input value={author.nameEn} onChange={(event) => updateAuthor(index, "nameEn", event.target.value)} /></label>
            <label>소속(국문)<input value={author.affiliationKo} onChange={(event) => updateAuthor(index, "affiliationKo", event.target.value)} required /></label>
            <label>소속(영문)<input value={author.affiliationEn} onChange={(event) => updateAuthor(index, "affiliationEn", event.target.value)} /></label>
            <label className="wide">이메일<input type="email" value={author.email} onChange={(event) => updateAuthor(index, "email", event.target.value)} required /></label>
          </div>
        </article>)}
        {authorship === "COAUTHORED" && <button className="secondary-button add-author" type="button" onClick={() => setAuthors((current) => [...current, { ...EMPTY_AUTHOR }])}>＋ 공동저자 추가</button>}
        <div className="wizard-actions"><button className="secondary-button" type="button" onClick={() => goToStep(2)}>← 이전</button><button className="button button-primary">원고파일 등록 <span>→</span></button></div>
      </form>
    </section>}

    {step === 4 && <section className="wizard-panel">
      <div className="wizard-heading"><small>STEP 04</small><h2>원고파일 확인 및 최종 제출</h2><p>심사용 익명화 원고에는 저자명, 소속, 이메일, 감사의 글 등 식별정보가 없어야 합니다.</p></div>
      <div className="submission-review"><div><span>저자 구성</span><strong>{authorship === "SOLE" ? "단독저자" : `공동저자 ${authors.length}명`}</strong></div><div><span>교신저자</span><strong>{authors[correspondingIndex]?.nameKo}</strong><small>{authors[correspondingIndex]?.email}</small></div><div className="wide"><span>논문제목</span><strong>{paper.titleKo}</strong><small>{paper.titleEn}</small></div></div>
      <form className="wizard-form file-step-form" onSubmit={handleFinalSubmit}>
        <label>원고파일<input name="originalFile" type="file" accept=".pdf,.doc,.docx,.hwp" required /><small>저자정보가 포함된 편집용 원고</small></label>
        <label>익명화 원고<input name="anonymizedFile" type="file" accept=".pdf,.doc,.docx,.hwp" required /><small>심사위원에게 제공되는 비식별 원고</small></label>
        <label className="final-consent wide"><input type="checkbox" checked={copyrightAgreed} onChange={(event) => setCopyrightAgreed(event.target.checked)} required /><span>모든 저자를 대표하여 게재 시 저작권 및 이용조건에 동의합니다.</span></label>
        {message && <p className="form-message wide" role="status">{message}</p>}
        <div className="wizard-actions wide"><button className="secondary-button" type="button" disabled={busy} onClick={() => goToStep(3)}>← 이전</button><button className="button button-primary" disabled={busy}>{busy ? "투고 처리 중…" : "논문 투고 완료"} <span>→</span></button></div>
      </form>
    </section>}
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
