"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { FileSubmissionModal, openAuthorReviewResult } from "@/components/author-dashboard";
import { STATUS_LABELS, formatDate, getErrorMessage, splitKeywords, type Manuscript, type Profile } from "@/lib/journal";
import { ETHICS_POLICY_VERSION, RESEARCH_PUBLICATION_ETHICS_POLICY } from "@/lib/policies";
import { getSupabaseClient } from "@/lib/supabase/client";
import { uploadJournalFile } from "@/lib/supabase/files";

type SubmissionTab = "new" | "revision" | "final" | "status";
type WizardStep = 1 | 2 | 3 | 4;
type AuthorshipType = "SOLE" | "COAUTHORED";
type DraftAuthor = { nameKo: string; nameEn: string; affiliationKo: string; affiliationEn: string; email: string };
type PaperDraft = { titleKo: string; titleEn: string; abstractKo: string; abstractEn: string; keywordsKo: string; keywordsEn: string; researchField: string };

const EMPTY_AUTHOR: DraftAuthor = { nameKo: "", nameEn: "", affiliationKo: "", affiliationEn: "", email: "" };
const EMPTY_PAPER: PaperDraft = { titleKo: "", titleEn: "", abstractKo: "", abstractEn: "", keywordsKo: "", keywordsEn: "", researchField: "" };
const STEP_LABELS = ["연구윤리 동의", "저자구성·교신저자", "논문·초록 입력", "원고파일"];
const STEP_HASHES = ["ethics", "authors", "abstract", "files"];
const AUTHOR_COUNT_OPTIONS = Array.from({ length: 10 }, (_, index) => index + 1);
const HANGUL_PATTERN = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const LATIN_PATTERN = /[A-Za-z]/;

function isKoreanText(value: string) {
  return HANGUL_PATTERN.test(value) && !LATIN_PATTERN.test(value);
}

function isEnglishText(value: string) {
  return LATIN_PATTERN.test(value) && !HANGUL_PATTERN.test(value);
}

function draftIdFromHash() {
  if (typeof window === "undefined") return null;
  const query = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(query).get("draft");
}

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

  if (showNewSubmission) return <NewSubmissionWizard profile={profile} initialDraftId={draftIdFromHash()} onCancel={closeNewSubmission} onMyPage={onMyPage} onComplete={loadManuscripts} />;

  return <div className="submission-center">
    <section className="submission-center-hero"><div><small>ONLINE MANUSCRIPT SUBMISSION</small><h1>온라인 논문 투고</h1><p>한국디지털건강체력연구 논문 제출과 진행상태를 관리합니다.</p></div><button type="button" onClick={onMyPage}>My Page <span>→</span></button></section>
    <nav className="submission-center-tabs" aria-label="논문 제출 메뉴">
      {(Object.keys(TAB_COPY) as SubmissionTab[]).map((id) => <button className={tab === id ? "active" : ""} type="button" onClick={() => setTab(id)} key={id}><strong>{TAB_COPY[id].title}</strong><span>→</span></button>)}
    </nav>
    <div className="submission-center-body">
      <section className="submission-main-card">
        <div className="submission-section-title"><small>AUTHOR SERVICE</small><h2>{TAB_COPY[tab].title}</h2><p>{TAB_COPY[tab].description}</p></div>
        {tab === "new" ? <div className="new-submission-guide">
          <ol><li><span>01</span><div><strong>연구·출판윤리규정 동의</strong><p>규정 전문을 확인하고 동의한 뒤 다음 단계로 이동합니다.</p></div></li><li><span>02</span><div><strong>저자구성·교신저자 지정</strong><p>저자 수와 순서를 정하고 교신저자 1명을 지정합니다.</p></div></li><li><span>03</span><div><strong>논문·초록 및 원고 등록</strong><p>국·영문 초록을 입력하고 익명화 원고를 제출합니다.</p></div></li></ol>
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

function NewSubmissionWizard({ profile, initialDraftId, onCancel, onMyPage, onComplete }: { profile: Profile; initialDraftId: string | null; onCancel: () => void; onMyPage: () => void; onComplete: () => Promise<void> }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [ethicsAgreed, setEthicsAgreed] = useState(false);
  const [ethicsAgreedAt, setEthicsAgreedAt] = useState<string | null>(null);
  const [paper, setPaper] = useState<PaperDraft>(EMPTY_PAPER);
  const [authors, setAuthors] = useState<DraftAuthor[]>([{ ...EMPTY_AUTHOR, nameKo: profile.full_name, affiliationKo: profile.affiliation ?? "", email: profile.email }]);
  const [submittingAuthorIndex, setSubmittingAuthorIndex] = useState(0);
  const [correspondingIndex, setCorrespondingIndex] = useState(0);
  const [copyrightAgreed, setCopyrightAgreed] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [loadingDraft, setLoadingDraft] = useState(Boolean(initialDraftId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [completedCode, setCompletedCode] = useState("");
  const authorship: AuthorshipType = authors.length === 1 ? "SOLE" : "COAUTHORED";
  const ethicsAuthorNamesComplete = authors.length > 0 && authors.every((author) => author.nameKo.trim().length > 0);
  const ethicsComplete = ethicsAgreed && ethicsAuthorNamesComplete;

  useEffect(() => {
    if (!initialDraftId) return;
    const targetDraftId = initialDraftId;
    let active = true;
    async function loadDraft() {
      const supabase = getSupabaseClient();
      const [manuscriptResult, authorResult] = await Promise.all([
        supabase.from("manuscripts").select("*").eq("id", targetDraftId).eq("status", "DRAFT").single(),
        supabase.from("authors").select("*").eq("manuscript_id", targetDraftId).order("sort_order"),
      ]);
      if (!active) return;
      if (manuscriptResult.error) {
        setMessage("임시저장 원고를 불러오지 못했습니다. My Page에서 다시 선택해 주세요.");
        setMessageIsError(true);
        setLoadingDraft(false);
        return;
      }
      const manuscript = manuscriptResult.data;
      setPaper({
        titleKo: manuscript.title_ko,
        titleEn: manuscript.title_en,
        abstractKo: manuscript.abstract_ko,
        abstractEn: manuscript.abstract_en,
        keywordsKo: manuscript.keywords_ko.join(", "),
        keywordsEn: manuscript.keywords_en.join(", "),
        researchField: manuscript.research_field,
      });
      const savedEthicsNames = manuscript.ethics_author_names ?? [];
      const hasCurrentEthicsAgreement = manuscript.ethics_confirmed
        && manuscript.ethics_policy_version === ETHICS_POLICY_VERSION
        && Boolean(manuscript.ethics_agreed_at);
      setEthicsAgreed(hasCurrentEthicsAgreement);
      setEthicsAgreedAt(hasCurrentEthicsAgreement ? manuscript.ethics_agreed_at : null);
      setCopyrightAgreed(manuscript.copyright_agreed);
      if (authorResult.data?.length) {
        setAuthors(authorResult.data.map((author) => ({ nameKo: author.name_ko, nameEn: author.name_en ?? "", affiliationKo: author.affiliation_ko, affiliationEn: author.affiliation_en ?? "", email: author.email })));
        setSubmittingAuthorIndex(Math.max(0, authorResult.data.findIndex((author) => author.user_id === profile.id)));
        setCorrespondingIndex(Math.max(0, authorResult.data.findIndex((author) => author.is_corresponding)));
        setStep(hasCurrentEthicsAgreement ? (manuscript.title_ko || manuscript.title_en ? 3 : 2) : 1);
      } else if (savedEthicsNames.length) {
        setAuthors(savedEthicsNames.map((name, index) => index === 0
          ? { ...EMPTY_AUTHOR, nameKo: name, affiliationKo: profile.affiliation ?? "", email: profile.email }
          : { ...EMPTY_AUTHOR, nameKo: name }));
        setStep(hasCurrentEthicsAgreement ? 2 : 1);
      } else if (hasCurrentEthicsAgreement) {
        setStep(2);
      }
      setMessage("임시저장한 내용을 불러왔습니다.");
      setMessageIsError(false);
      setLoadingDraft(false);
    }
    void loadDraft();
    return () => { active = false; };
  }, [initialDraftId, profile.affiliation, profile.email, profile.id]);

  function goToStep(next: WizardStep) {
    setMessage("");
    setMessageIsError(false);
    setStep(next);
    const draftQuery = draftId ? `&draft=${encodeURIComponent(draftId)}` : "";
    window.history.replaceState(null, "", `#online-submission?mode=new&step=${STEP_HASHES[next - 1]}${draftQuery}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setAuthorCount(nextCount: number) {
    setSubmittingAuthorIndex((current) => current < nextCount ? current : 0);
    setCorrespondingIndex((current) => current < nextCount ? current : 0);
    setAuthors((current) => {
      if (nextCount <= current.length) return current.slice(0, nextCount);
      return [...current, ...Array.from({ length: nextCount - current.length }, () => ({ ...EMPTY_AUTHOR }))];
    });
  }

  function updatePaper(key: keyof PaperDraft, value: string) {
    setPaper((current) => ({ ...current, [key]: value }));
  }

  function updateAuthor(index: number, key: keyof DraftAuthor, value: string) {
    setAuthors((current) => current.map((author, authorIndex) => authorIndex === index ? { ...author, [key]: value } : author));
  }

  function setEthicsAuthorCount(nextCount: number) {
    setAuthorCount(nextCount);
    setEthicsAgreement(false);
  }

  function updateEthicsAuthorName(index: number, value: string) {
    updateAuthor(index, "nameKo", value);
    setEthicsAgreement(false);
  }

  function setEthicsAgreement(checked: boolean) {
    setEthicsAgreed(checked);
    setEthicsAgreedAt(checked ? new Date().toISOString() : null);
  }

  function validatePaperLanguage() {
    if (!isKoreanText(paper.titleKo)) return "논문제목(국문)은 한글로 작성해 주세요.";
    if (!isEnglishText(paper.titleEn)) return "논문제목(영문)은 영어로 작성해 주세요.";
    if (!isKoreanText(paper.abstractKo)) return "국문초록은 한글로 작성해 주세요.";
    if (!isEnglishText(paper.abstractEn)) return "영문초록은 영어로 작성해 주세요.";
    if (!isKoreanText(paper.keywordsKo)) return "국문 핵심어는 한글로 작성해 주세요.";
    if (!isEnglishText(paper.keywordsEn)) return "영문 Keywords는 영어로 작성해 주세요.";
    return "";
  }

  function validateAuthorLanguage() {
    if (authorship === "COAUTHORED" && authors.length < 2) return "공동저자 논문은 저자를 2명 이상 입력해 주세요.";
    for (const [index, author] of authors.entries()) {
      const label = index === 0 ? "투고자" : `공동저자 ${index}`;
      if (!isKoreanText(author.nameKo)) return `${label} 이름(국문)은 한글로 작성해 주세요.`;
      if (author.nameEn && !isEnglishText(author.nameEn)) return `${label} 이름(영문)은 영어로 작성해 주세요.`;
      if (!isKoreanText(author.affiliationKo)) return `${label} 소속(국문)은 한글로 작성해 주세요.`;
      if (author.affiliationEn && !isEnglishText(author.affiliationEn)) return `${label} 소속(영문)은 영어로 작성해 주세요.`;
    }
    return "";
  }

  function showValidationError(error: string) {
    setMessage(error);
    setMessageIsError(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function persistDraft(syncAuthors: boolean) {
    const supabase = getSupabaseClient();
    const manuscriptValues = {
      title_ko: paper.titleKo,
      title_en: paper.titleEn,
      abstract_ko: paper.abstractKo,
      abstract_en: paper.abstractEn,
      keywords_ko: splitKeywords(paper.keywordsKo),
      keywords_en: splitKeywords(paper.keywordsEn),
      research_field: paper.researchField,
      ethics_confirmed: ethicsComplete,
      conflict_of_interest_confirmed: ethicsComplete,
      ethics_policy_version: ethicsComplete ? ETHICS_POLICY_VERSION : null,
      ethics_agreed_at: ethicsComplete ? (ethicsAgreedAt ?? new Date().toISOString()) : null,
      ethics_author_names: authors.map((author) => author.nameKo.trim()).filter(Boolean),
      copyright_agreed: copyrightAgreed,
    };
    let manuscriptId = draftId;
    if (manuscriptId) {
      const { error } = await supabase.from("manuscripts").update(manuscriptValues).eq("id", manuscriptId).eq("status", "DRAFT");
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("manuscripts").insert(manuscriptValues).select("id").single();
      if (error) throw error;
      manuscriptId = data.id;
      setDraftId(manuscriptId);
    }
    if (syncAuthors) {
      const { error: deleteError } = await supabase.from("authors").delete().eq("manuscript_id", manuscriptId);
      if (deleteError) throw deleteError;
      const authorRows = authors.map((author, index) => ({
        manuscript_id: manuscriptId,
        user_id: index === submittingAuthorIndex ? profile.id : null,
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
    }
    window.history.replaceState(null, "", `#online-submission?mode=new&step=${STEP_HASHES[step - 1]}&draft=${encodeURIComponent(manuscriptId)}`);
    return manuscriptId;
  }

  async function saveDraft(syncAuthors = false) {
    setBusy(true);
    setMessage("임시저장하고 있습니다…");
    setMessageIsError(false);
    try {
      await persistDraft(syncAuthors);
      await onComplete();
      setMessage("현재 단계까지 임시저장했습니다. My Page에서 이어서 작성할 수 있습니다.");
    } catch (error) {
      setMessage(getErrorMessage(error));
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  function continueFromPaper(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validatePaperLanguage();
    if (error) return showValidationError(error);
    goToStep(4);
  }

  function continueFromAuthors(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateAuthorLanguage();
    if (error) return showValidationError(error);
    goToStep(3);
  }

  async function handleFinalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ethicsComplete) return showValidationError("연구·출판윤리규정에 동의한 뒤 제출해 주세요.");
    const languageError = validatePaperLanguage() || validateAuthorLanguage();
    if (languageError) return showValidationError(languageError);
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
    setMessageIsError(false);
    try {
      const supabase = getSupabaseClient();
      const manuscriptId = await persistDraft(true);
      const { error: consentError } = await supabase.from("manuscripts").update({ ethics_confirmed: true, conflict_of_interest_confirmed: true, copyright_agreed: true }).eq("id", manuscriptId).eq("status", "DRAFT");
      if (consentError) throw consentError;

      setMessage("원고파일을 안전하게 업로드하고 있습니다…");
      await uploadJournalFile(original, manuscriptId, "ORIGINAL", 1);
      await uploadJournalFile(anonymized, manuscriptId, "ANONYMIZED", 1);
      const { error: submitError } = await supabase.rpc("submit_manuscript", { target_manuscript_id: manuscriptId });
      if (submitError) throw submitError;
      const { data: submitted } = await supabase.from("manuscripts").select("manuscript_code").eq("id", manuscriptId).single();
      setCompletedCode(submitted?.manuscript_code ?? "접수 완료");
      await onComplete();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setMessage(`${getErrorMessage(error)} 저장된 임시원고가 있다면 My Page에서 이어서 제출할 수 있습니다.`);
      setMessageIsError(true);
      await onComplete();
    } finally {
      setBusy(false);
    }
  }

  if (loadingDraft) return <div className="new-submission-page"><section className="wizard-complete"><small>DRAFT MANUSCRIPT</small><div>↻</div><h1>임시저장 원고를 불러오는 중입니다.</h1></section></div>;

  if (completedCode) return <div className="new-submission-page"><section className="wizard-complete"><small>SUBMISSION COMPLETE</small><div>✓</div><h1>논문 투고가 완료되었습니다.</h1><p>논문번호 <strong>{completedCode}</strong>로 접수되었습니다. My Page에서 심사 진행상태를 확인할 수 있습니다.</p><button className="button button-primary" type="button" onClick={onMyPage}>My Page에서 확인 <span>→</span></button></section></div>;

  return <div className="new-submission-page">
    <div className="new-submission-top"><button type="button" onClick={onCancel}>← 온라인 논문 투고로 돌아가기</button><span>{draftId ? "임시저장 원고를 작성 중입니다." : "각 단계의 임시저장 버튼으로 나중에 이어서 작성할 수 있습니다."}</span></div>
    <header className="new-submission-header"><small>NEW MANUSCRIPT SUBMISSION</small><h1>신규 논문 투고</h1><p>연구윤리 확인부터 원고 제출까지 순서대로 진행해 주세요.</p></header>
    <ol className="manuscript-progress" aria-label="신규 논문 투고 단계">
      {STEP_LABELS.map((label, index) => <li className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} key={label}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label}</strong></li>)}
    </ol>
    {message && <div className={`wizard-message ${messageIsError ? "error" : ""}`} role="status">{message}</div>}

    {step === 1 && <section className="wizard-panel">
      <div className="wizard-heading"><small>STEP 01</small><h2>연구·출판윤리규정 확인</h2><p>먼저 규정 전문을 확인하고 동의해 주세요. 저자 구성과 교신저자 지정은 동의 후 다음 화면에서 진행합니다.</p></div>
      <article className="ethics-policy-card" aria-labelledby="ethics-policy-title">
        <header><div><small>RESEARCH &amp; PUBLICATION ETHICS</small><h3 id="ethics-policy-title">연구·출판윤리규정</h3></div><span>시행 2026. 8. 1.</span></header>
        <pre tabIndex={0}>{RESEARCH_PUBLICATION_ETHICS_POLICY}</pre>
      </article>
      <div className="ethics-notice"><strong>투고 책임자 확인</strong><p>투고 책임자는 논문에 등록할 모든 저자에게 규정 전문을 공유하고 동의를 받아야 합니다. 동의 시각과 다음 단계에서 등록하는 저자 명단은 논문 기록에 함께 보존됩니다.</p></div>
      <section className="ethics-author-signatories" aria-labelledby="ethics-author-signatories-title">
        <header>
          <div><small>ALL AUTHORS</small><h3 id="ethics-author-signatories-title">연구윤리 서약 연구자 명단</h3><p>논문에 참여한 연구자 전원의 이름을 빠짐없이 입력해 주세요.</p></div>
          <label><span>총 연구자 수</span><select value={authors.length} onChange={(event) => setEthicsAuthorCount(Number(event.target.value))}>{AUTHOR_COUNT_OPTIONS.map((count) => <option value={count} key={count}>{count}명</option>)}</select></label>
        </header>
        <div className="ethics-author-name-grid">
          {authors.map((author, index) => <label key={index}><span>{authors.length === 1 ? "단독저자" : `제${index + 1}저자`} 이름</span><input value={author.nameKo} onChange={(event) => updateEthicsAuthorName(index, event.target.value)} placeholder="한글 성명 입력" required /></label>)}
        </div>
        <p className="ethics-author-help">입력한 이름은 다음 단계의 저자 구성에 그대로 반영됩니다. 이름이나 인원수를 변경하면 서약 동의를 다시 확인해야 합니다.</p>
      </section>
      <div className="ethics-checklist ethics-final-agreement">
        <label><input type="checkbox" checked={ethicsAgreed} disabled={!ethicsAuthorNamesComplete} onChange={(event) => setEthicsAgreement(event.target.checked)} /><span><strong>위에 이름을 작성한 연구자 전원이 연구·출판윤리규정에 동의합니다.</strong>투고 책임자는 규정 전문을 확인했으며, 입력한 모든 연구자에게 규정을 안내하고 동의를 받았음을 확인합니다.</span></label>
      </div>
      <div className="wizard-actions"><button className="draft-save-button" type="button" disabled={busy} onClick={() => void saveDraft(false)}>{busy ? "저장 중…" : "임시저장"}</button><button className="button button-primary" type="button" disabled={!ethicsComplete || busy} onClick={() => goToStep(2)}>동의하고 저자 구성 입력 <span>→</span></button></div>
    </section>}

    {step === 2 && <section className="wizard-panel">
      <div className="wizard-heading"><small>STEP 02</small><h2>저자 구성 및 교신저자 지정</h2><p>총 저자 수를 선택한 뒤 제1저자부터 논문 표기 순서대로 입력하고 교신저자 1명을 지정해 주세요.</p></div>
      <form className="author-editor-list" onSubmit={continueFromAuthors}>
        <section className="author-composition-toolbar">
          <label><span>총 저자 수</span><select value={authors.length} onChange={(event) => setAuthorCount(Number(event.target.value))}>{AUTHOR_COUNT_OPTIONS.map((count) => <option value={count} key={count}>{count}명</option>)}</select></label>
          <div><span>저자 구성</span><strong>{authorship === "SOLE" ? "단독저자" : `공동저자 ${authors.length}명`}</strong></div>
          <div><span>로그인한 투고자</span><strong>{authors[submittingAuthorIndex]?.nameKo || `제${submittingAuthorIndex + 1}저자`}</strong></div>
          <div><span>교신저자</span><strong>{authors[correspondingIndex]?.nameKo || `제${correspondingIndex + 1}저자`}</strong></div>
        </section>
        {authors.map((author, index) => <article className="author-editor-card" key={index}>
          <header><div><span>{String(index + 1).padStart(2, "0")}</span><strong>{authorship === "SOLE" ? "단독저자" : `제${index + 1}저자`}</strong><small>{authorship === "SOLE" ? "투고자 본인" : index === 0 ? "주저자" : "공동저자"}</small></div></header>
          <div className="author-role-choices">
            <label className="corresponding-choice"><input type="radio" name="submittingAuthor" checked={submittingAuthorIndex === index} disabled={authorship === "SOLE"} onChange={() => setSubmittingAuthorIndex(index)} /><span><strong>{authorship === "SOLE" ? "로그인한 투고자" : "현재 로그인한 투고자로 지정"}</strong>이 계정으로 논문 진행상태와 심사결과를 관리할 저자입니다.</span></label>
            <label className="corresponding-choice"><input type="radio" name="correspondingAuthor" checked={correspondingIndex === index} disabled={authorship === "SOLE"} onChange={() => setCorrespondingIndex(index)} /><span><strong>{authorship === "SOLE" ? "단독저자·교신저자" : "교신저자로 지정"}</strong>{authorship === "SOLE" ? "단독저자는 교신저자로 자동 지정됩니다." : "편집위원회와 연락하고 논문을 최종 확인할 저자입니다."}</span></label>
          </div>
          <div className="wizard-form">
            <label>이름(국문)<input value={author.nameKo} onChange={(event) => updateAuthor(index, "nameKo", event.target.value)} required /></label>
            <label>이름(영문)<input value={author.nameEn} onChange={(event) => updateAuthor(index, "nameEn", event.target.value)} /></label>
            <label>소속(국문)<input value={author.affiliationKo} onChange={(event) => updateAuthor(index, "affiliationKo", event.target.value)} required /></label>
            <label>소속(영문)<input value={author.affiliationEn} onChange={(event) => updateAuthor(index, "affiliationEn", event.target.value)} /></label>
            <label className="wide">이메일<input type="email" value={author.email} onChange={(event) => updateAuthor(index, "email", event.target.value)} required /></label>
          </div>
        </article>)}
        <div className="wizard-actions"><button className="secondary-button" type="button" onClick={() => goToStep(1)}>← 이전</button><button className="draft-save-button" type="button" disabled={busy} onClick={() => void saveDraft(true)}>{busy ? "저장 중…" : "임시저장"}</button><button className="button button-primary" disabled={busy}>논문·초록 입력 <span>→</span></button></div>
      </form>
    </section>}

    {step === 3 && <section className="wizard-panel">
      <div className="wizard-heading"><small>STEP 03</small><h2>논문 및 초록 입력</h2><p>심사와 색인에 사용될 국·영문 정보를 정확하게 입력해 주세요.</p></div>
      <form className="wizard-form" onSubmit={continueFromPaper}>
        <label className="wide">논문제목(국문)<input value={paper.titleKo} onChange={(event) => updatePaper("titleKo", event.target.value)} required /></label>
        <label className="wide">논문제목(영문)<input value={paper.titleEn} onChange={(event) => updatePaper("titleEn", event.target.value)} required /></label>
        <label className="wide">국문초록<textarea rows={7} value={paper.abstractKo} onChange={(event) => updatePaper("abstractKo", event.target.value)} required /></label>
        <label className="wide">영문초록<textarea rows={7} value={paper.abstractEn} onChange={(event) => updatePaper("abstractEn", event.target.value)} required /></label>
        <label>국문 핵심어<input value={paper.keywordsKo} onChange={(event) => updatePaper("keywordsKo", event.target.value)} placeholder="쉼표로 구분" required /></label>
        <label>영문 Keywords<input value={paper.keywordsEn} onChange={(event) => updatePaper("keywordsEn", event.target.value)} placeholder="Comma separated" required /></label>
        <label className="wide">연구분야<select value={paper.researchField} onChange={(event) => updatePaper("researchField", event.target.value)} required><option value="" disabled>선택해 주세요</option><option>디지털 헬스</option><option>건강체력 측정·평가</option><option>운동생리학</option><option>운동처방·재활</option><option>학교·지역사회 건강</option><option>기타</option></select></label>
        <div className="wizard-actions wide"><button className="secondary-button" type="button" onClick={() => goToStep(2)}>← 이전</button><button className="draft-save-button" type="button" disabled={busy} onClick={() => void saveDraft(true)}>{busy ? "저장 중…" : "임시저장"}</button><button className="button button-primary" disabled={busy}>원고파일 등록 <span>→</span></button></div>
      </form>
    </section>}

    {step === 4 && <section className="wizard-panel">
      <div className="wizard-heading"><small>STEP 04</small><h2>원고파일 확인 및 최종 제출</h2><p>심사용 익명화 원고에는 저자명, 소속, 이메일, 감사의 글 등 식별정보가 없어야 합니다.</p></div>
      <div className="submission-review"><div><span>저자 구성</span><strong>{authorship === "SOLE" ? "단독저자" : `공동저자 ${authors.length}명`}</strong></div><div><span>교신저자</span><strong>{authors[correspondingIndex]?.nameKo}</strong><small>{authors[correspondingIndex]?.email}</small></div><div className="wide"><span>논문제목</span><strong>{paper.titleKo}</strong><small>{paper.titleEn}</small></div></div>
      <form className="wizard-form file-step-form" onSubmit={handleFinalSubmit}>
        <label>원고파일<input name="originalFile" type="file" accept=".pdf,.doc,.docx,.hwp" required /><small>저자정보가 포함된 편집용 원고</small></label>
        <label>익명화 원고<input name="anonymizedFile" type="file" accept=".pdf,.doc,.docx,.hwp" required /><small>심사위원에게 제공되는 비식별 원고</small></label>
        <label className="final-consent wide"><input type="checkbox" checked={copyrightAgreed} onChange={(event) => setCopyrightAgreed(event.target.checked)} required /><span>모든 저자를 대표하여 게재 시 저작권 및 이용조건에 동의합니다.</span></label>
        <div className="wizard-actions wide"><button className="secondary-button" type="button" disabled={busy} onClick={() => goToStep(3)}>← 이전</button><button className="draft-save-button" type="button" disabled={busy} onClick={() => void saveDraft(true)}>{busy ? "저장 중…" : "임시저장"}</button><button className="button button-primary" disabled={busy}>{busy ? "투고 처리 중…" : "논문 투고 완료"} <span>→</span></button></div>
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
