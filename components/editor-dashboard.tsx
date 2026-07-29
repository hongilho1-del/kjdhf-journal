"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { BoardManagement } from "@/components/board-management";
import { JournalPageManagement } from "@/components/journal-page-management";
import {
  RECOMMENDATION_LABELS,
  ROLE_LABELS,
  STATUS_GROUPS,
  STATUS_LABELS,
  formatDate,
  getErrorMessage,
  type AppRole,
  type EditorialDecision,
  type Manuscript,
  type ManuscriptStatus,
  type Profile,
  type ProfileRole,
} from "@/lib/journal";
import type { Tables } from "@/lib/supabase/database.types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { uploadJournalFile } from "@/lib/supabase/files";

type Assignment = Tables<"reviewer_assignments">;
type Review = Tables<"reviews"> & { reviewer_assignments: { manuscript_id: string; reviewer_id: string; round_no: number } };
type Author = Tables<"authors">;
type Issue = Tables<"issues">;

function dateInputAfter(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function assignmentErrorMessage(message: string) {
  if (/due date must be in the future/i.test(message)) return "심사기한은 오늘 이후 날짜로 선택해 주세요.";
  if (/duplicate key|reviewer_assignments_manuscript_id_reviewer_id_round_no/i.test(message)) return "이미 현재 심사차수에 배정된 심사위원입니다.";
  if (/three active reviewers/i.test(message)) return "현재 심사차수에 심사위원 3명이 모두 배정되었습니다.";
  if (/active reviewer not found/i.test(message)) return "활성화된 심사위원 계정을 찾을 수 없습니다.";
  if (/assignment is not allowed in the current status/i.test(message)) return "형식검토를 시작한 후 심사위원을 배정해 주세요.";
  return message;
}

export function EditorDashboard({ profile }: { profile: Profile }) {
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileRoles, setProfileRoles] = useState<ProfileRole[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selected, setSelected] = useState<Manuscript | null>(null);
  const [tab, setTab] = useState<"manuscripts" | "users" | "boards" | "journal-pages" | "issues">("manuscripts");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabaseClient();
    const [manuscriptResult, profileResult, profileRoleResult, assignmentResult, reviewResult, issueResult] = await Promise.all([
      supabase.from("manuscripts").select("*").neq("status", "DRAFT").order("submitted_at", { ascending: false, nullsFirst: false }),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("profile_roles").select("*"),
      supabase.from("reviewer_assignments").select("*").order("due_at", { ascending: true }),
      supabase.from("reviews").select("*, reviewer_assignments!inner(manuscript_id,reviewer_id,round_no)"),
      supabase.from("issues").select("*").order("year", { ascending: false }).order("issue_number", { ascending: false }),
    ]);
    const firstError = [manuscriptResult.error, profileResult.error, profileRoleResult.error, assignmentResult.error, reviewResult.error, issueResult.error].find(Boolean);
    if (firstError) setMessage(firstError.message);
    setManuscripts(manuscriptResult.data ?? []);
    setProfiles(profileResult.data ?? []);
    setProfileRoles(profileRoleResult.data ?? []);
    setAssignments(assignmentResult.data ?? []);
    setReviews((reviewResult.data ?? []) as Review[]);
    setIssues(issueResult.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const stats = useMemo(() => ({
    all: manuscripts.length,
    new: manuscripts.filter((item) => STATUS_GROUPS.new.includes(item.status)).length,
    assignment: manuscripts.filter((item) => STATUS_GROUPS.assignment.includes(item.status)).length,
    reviewing: manuscripts.filter((item) => STATUS_GROUPS.reviewing.includes(item.status)).length,
    revision: manuscripts.filter((item) => STATUS_GROUPS.revision.includes(item.status)).length,
    accepted: manuscripts.filter((item) => STATUS_GROUPS.accepted.includes(item.status)).length,
    rejected: manuscripts.filter((item) => STATUS_GROUPS.rejected.includes(item.status)).length,
    withdrawn: manuscripts.filter((item) => STATUS_GROUPS.withdrawn.includes(item.status)).length,
  }), [manuscripts]);

  return <div className="dashboard-stack">
    <section className="dashboard-hero editor-hero"><div><p>{profile.role} DASHBOARD</p><h1>편집업무 통합현황</h1><span>접수, 심사위원 배정, 심사결과와 발행 준비를 관리합니다.</span></div><div className="dashboard-date"><span>오늘</span><strong>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" }).format(new Date())}</strong></div></section>
    <section className="metric-grid admin-metrics"><Metric label="전체 투고" value={stats.all} /><Metric label="신규·형식검토" value={stats.new} tone="alert" /><Metric label="배정 대기" value={stats.assignment} /><Metric label="심사 중" value={stats.reviewing} /><Metric label="수정 중" value={stats.revision} /><Metric label="게재 단계" value={stats.accepted} tone="success" /><Metric label="게재불가" value={stats.rejected} tone="danger" /><Metric label="투고철회" value={stats.withdrawn} tone="danger" />{profile.role === "ADMIN" && <Metric label="회원 승인대기" value={profiles.filter((person) => !person.is_active).length} tone="alert" />}</section>
    <nav className="workspace-tabs" aria-label="편집관리 메뉴"><button className={tab === "manuscripts" ? "active" : ""} onClick={() => setTab("manuscripts")}>논문 진행현황</button>{profile.role === "ADMIN" && <><button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>가입·권한 관리</button><button className={tab === "boards" ? "active" : ""} onClick={() => setTab("boards")}>공지·행사 관리</button><button className={tab === "journal-pages" ? "active" : ""} onClick={() => setTab("journal-pages")}>학회지 안내 관리</button><button className={tab === "issues" ? "active" : ""} onClick={() => setTab("issues")}>발행호 관리</button></>}</nav>
    {message && <div className="notice-box" role="status">{message}</div>}
    {tab === "manuscripts" && <ManuscriptBoard loading={loading} manuscripts={manuscripts} assignments={assignments} profiles={profiles} onSelect={setSelected} />}
    {tab === "users" && profile.role === "ADMIN" && <UserManagement profiles={profiles} profileRoles={profileRoles} currentUserId={profile.id} onChanged={loadData} />}
    {tab === "boards" && profile.role === "ADMIN" && <BoardManagement />}
    {tab === "journal-pages" && profile.role === "ADMIN" && <JournalPageManagement profile={profile} />}
    {tab === "issues" && profile.role === "ADMIN" && <IssueManagement issues={issues} onChanged={loadData} />}
    {selected && <EditorialDetail manuscript={selected} profiles={profiles} profileRoles={profileRoles} assignments={assignments} reviews={reviews} issues={issues} isAdmin={profile.role === "ADMIN"} onClose={() => setSelected(null)} onChanged={async () => { await loadData(); setSelected((current) => current ? manuscripts.find((item) => item.id === current.id) ?? current : null); }} />}
  </div>;
}

function Metric({ label, value, tone = "default" }: { label: string; value: number; tone?: string }) {
  return <article className={`metric-card metric-${tone}`}><span>{label}</span><strong>{String(value).padStart(2, "0")}</strong><i /></article>;
}

function ManuscriptBoard({ loading, manuscripts, assignments, profiles, onSelect }: { loading: boolean; manuscripts: Manuscript[]; assignments: Assignment[]; profiles: Profile[]; onSelect: (item: Manuscript) => void }) {
  return <section className="workspace-card"><div className="card-heading"><div><p>EDITORIAL QUEUE</p><h2>논문별 진행상태</h2></div><span>{manuscripts.length}건</span></div>
    {loading ? <div className="empty-state">편집현황을 불러오는 중입니다.</div> : manuscripts.length === 0 ? <div className="empty-state"><strong>접수된 논문이 없습니다.</strong></div> : <div className="data-table-wrap"><table className="data-table editorial-table"><thead><tr><th>논문번호</th><th>논문제목</th><th>현재상태</th><th>심사위원</th><th>심사기한</th><th>업무</th></tr></thead><tbody>
      {manuscripts.map((manuscript) => {
        const manuscriptAssignments = assignments.filter((item) => item.manuscript_id === manuscript.id && item.round_no === manuscript.round_no && !["DECLINED", "CANCELLED"].includes(item.status));
        return <tr key={manuscript.id}><td><b>{manuscript.manuscript_code ?? "임시저장"}</b><small>{formatDate(manuscript.submitted_at)}</small></td><td><button className="table-title" type="button" onClick={() => onSelect(manuscript)}>{manuscript.title_ko}</button><small>{manuscript.research_field}</small></td><td><span className={`status-badge status-${manuscript.status.toLowerCase()}`}>{STATUS_LABELS[manuscript.status]}</span></td><td>{manuscriptAssignments.length ? manuscriptAssignments.map((item) => <span className="reviewer-pill" key={item.id}>{profiles.find((person) => person.id === item.reviewer_id)?.full_name || "심사위원"} · {item.status}</span>) : <span className="muted-text">미배정</span>}</td><td>{formatDate(manuscript.current_due_at)}</td><td><button className="primary-small" type="button" onClick={() => onSelect(manuscript)}>편집업무</button></td></tr>;
      })}
    </tbody></table></div>}
  </section>;
}

function EditorialDetail({ manuscript, profiles, profileRoles, assignments, reviews, issues, isAdmin, onClose, onChanged }: { manuscript: Manuscript; profiles: Profile[]; profileRoles: ProfileRole[]; assignments: Assignment[]; reviews: Review[]; issues: Issue[]; isAdmin: boolean; onClose: () => void; onChanged: () => Promise<void> }) {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const manuscriptAssignments = assignments.filter((item) => item.manuscript_id === manuscript.id);
  const targetRound = Math.max(manuscript.round_no, 1);
  const targetRoundAssignments = manuscriptAssignments.filter((item) => item.round_no === targetRound);
  const currentRoundAssignments = targetRoundAssignments.filter((item) => !["DECLINED", "CANCELLED"].includes(item.status));
  const manuscriptReviews = reviews.filter((item) => item.reviewer_assignments.manuscript_id === manuscript.id);
  const assignedReviewerIds = new Set(targetRoundAssignments.map((item) => item.reviewer_id));
  const authorUserIds = new Set(authors.map((author) => author.user_id).filter(Boolean));
  const reviewerIds = new Set(profileRoles.filter((item) => item.role === "REVIEWER").map((item) => item.profile_id));
  const reviewers = profiles.filter((item) => reviewerIds.has(item.id) && item.is_active && !assignedReviewerIds.has(item.id) && !authorUserIds.has(item.id));
  const assignmentAllowed = (["FORMAT_REVIEW", "REVIEWER_SELECTION", "REVISION_SUBMITTED", "RE_REVIEW"] as ManuscriptStatus[]).includes(manuscript.status);

  useEffect(() => { void getSupabaseClient().from("authors").select("*").eq("manuscript_id", manuscript.id).order("sort_order").then(({ data }) => setAuthors(data ?? [])); }, [manuscript.id]);

  async function advance(nextStatus: ManuscriptStatus, note: string) {
    setBusy(true); setMessage("");
    const { error } = await getSupabaseClient().rpc("advance_manuscript_status", { target_manuscript_id: manuscript.id, next_status: nextStatus, change_note: note });
    if (error) setMessage(error.message); else { await onChanged(); setMessage("상태를 변경했습니다."); }
    setBusy(false);
  }

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const dueAt = String(form.get("dueAt"));
    if (!dueAt || dueAt < dateInputAfter(1)) {
      setMessage("심사기한은 오늘 이후 날짜로 선택해 주세요.");
      return;
    }
    setBusy(true); setMessage("");
    const { error } = await getSupabaseClient().rpc("assign_reviewer", { target_manuscript_id: manuscript.id, target_reviewer_id: String(form.get("reviewer")), review_due_at: new Date(`${dueAt}T23:59:59+09:00`).toISOString() });
    if (error) setMessage(assignmentErrorMessage(error.message)); else { await onChanged(); setMessage("심사위원 1명을 배정했습니다. 나머지 심사위원은 이후에 추가 배정할 수 있습니다."); formElement.reset(); }
    setBusy(false);
  }

  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); const form = new FormData(event.currentTarget);
    const { error } = await getSupabaseClient().rpc("record_editorial_decision", {
      target_manuscript_id: manuscript.id,
      new_decision: String(form.get("decision")) as EditorialDecision,
      public_author_letter: String(form.get("authorLetter")),
      private_internal_note: String(form.get("internalNote")),
    });
    if (error) setMessage(error.message); else { await onChanged(); setMessage("편집결정을 기록했습니다."); }
    setBusy(false);
  }

  const nextAction = ({ SUBMITTED: ["RECEIVED", "접수확인"], RECEIVED: ["FORMAT_REVIEW", "형식검토 시작"], FORMAT_REVIEW: ["REVIEWER_SELECTION", "심사위원 선정"], REVISION_SUBMITTED: ["RE_REVIEW", "재심사 시작"] } as Partial<Record<ManuscriptStatus, [ManuscriptStatus, string]>>)[manuscript.status];

  return <div className="modal-backdrop modal-scroll"><section className="editorial-modal" role="dialog" aria-modal="true"><button className="modal-close" type="button" onClick={onClose}>×</button><p className="panel-eyebrow">EDITORIAL RECORD · {manuscript.manuscript_code}</p><div className="editorial-title-row"><div><h2>{manuscript.title_ko}</h2><p>{manuscript.title_en}</p></div><span className={`status-badge status-${manuscript.status.toLowerCase()}`}>{STATUS_LABELS[manuscript.status]}</span></div>
    {message && <div className="notice-box" role="status">{message}</div>}
    <div className="editorial-detail-grid">
      <div className="detail-main">
        <section className="detail-section"><div className="detail-section-head"><h3>논문·저자 정보</h3>{nextAction && <button className="primary-small" disabled={busy} onClick={() => void advance(nextAction[0], nextAction[1])}>{nextAction[1]} →</button>}</div><p className="abstract-copy">{manuscript.abstract_ko}</p><div className="metadata-chips"><span>{manuscript.research_field}</span><span>{manuscript.keywords_ko.join(" · ")}</span><span>{manuscript.round_no}차</span></div><div className="author-list"><h4>저자정보 · 편집진 전용</h4>{authors.map((author) => <p key={author.id}><b>{author.name_ko}{author.is_corresponding && " · 교신"}</b><span>{author.affiliation_ko}</span><small>{author.email}</small></p>)}</div></section>
        <section className="detail-section"><h3>심사결과</h3>{manuscriptReviews.length ? manuscriptReviews.map((review) => <article className="review-result" key={review.id}><div><span>{review.reviewer_assignments.round_no}차 심사</span><b>{review.recommendation ? RECOMMENDATION_LABELS[review.recommendation] : "임시저장"}</b></div><h4>저자 공개용</h4><p>{review.author_comments || "—"}</p><h4>편집위원 전용</h4><p>{review.editor_comments || "—"}</p></article>) : <p className="muted-text">제출된 심사결과가 없습니다.</p>}</section>
        <section className="detail-section"><h3>편집결정 입력</h3>{manuscript.status === "WITHDRAWN" ? <div className="withdrawal-record"><strong>투고자가 원고를 철회했습니다.</strong><p>{manuscript.withdrawal_reason}</p><small>{formatDate(manuscript.withdrawn_at)}</small></div> : <form className="stack-form decision-form" onSubmit={decide}><label>판정<select name="decision" required><option value="REVISION_REQUESTED">수정요청</option><option value="ACCEPTED">게재가</option><option value="ACCEPT_WITH_REVISIONS">수정후게재</option><option value="REJECTED">게재불가</option><option value="FINAL_ACCEPTED">게재확정</option></select></label><label>저자 통보문<textarea name="authorLetter" rows={5} required /></label><label>내부 메모<textarea name="internalNote" rows={3} /></label><button className="button button-primary" disabled={busy}>편집결정 기록</button></form>}</section>
        {isAdmin && manuscript.status === "FINAL_ACCEPTED" && <PublicationForm manuscript={manuscript} issues={issues} onChanged={onChanged} />}
      </div>
      <aside className="detail-aside"><section><div className="assignment-heading"><h3>심사위원 배정</h3><strong>{currentRoundAssignments.length} / 3명</strong></div>{!assignmentAllowed ? <div className="notice-box">먼저 논문·저자 정보의 <b>형식검토 시작</b> 버튼을 눌러 주세요. 이후 심사위원을 배정할 수 있습니다.</div> : currentRoundAssignments.length >= 3 ? <div className="notice-box">현재 심사차수에 심사위원 3명이 모두 배정되었습니다.</div> : reviewers.length === 0 ? <div className="notice-box">추가로 배정할 수 있는 활성 심사위원이 없습니다.</div> : <form className="stack-form compact-form" onSubmit={assign}><p className="assignment-guide">심사위원을 1명씩 배정할 수 있습니다. 배정 후 나머지 인원을 이어서 추가해 주세요.</p><label>심사위원<select name="reviewer" required defaultValue=""><option value="" disabled>심사위원 선택</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.full_name} · {reviewer.affiliation ?? "소속 미입력"}</option>)}</select></label><label>심사기한<input name="dueAt" type="date" required min={dateInputAfter(1)} defaultValue={dateInputAfter(14)} /></label><button className="secondary-button" disabled={busy}>{busy ? "배정 중…" : "심사위원 1명 배정"}</button></form>}</section><section><h3>배정현황</h3>{manuscriptAssignments.length ? manuscriptAssignments.map((assignment) => <div className="assignment-row" key={assignment.id}><b>{profiles.find((person) => person.id === assignment.reviewer_id)?.full_name ?? "심사위원"}</b><span>{assignment.round_no}차 · {assignment.status}</span><small>{formatDate(assignment.due_at)}</small></div>) : <p className="muted-text">아직 배정되지 않았습니다.</p>}</section></aside>
    </div>
  </section></div>;
}

function UserManagement({ profiles, profileRoles, currentUserId, onChanged }: { profiles: Profile[]; profileRoles: ProfileRole[]; currentUserId: string; onChanged: () => Promise<void> }) {
  const [message, setMessage] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  function rolesFor(person: Profile) {
    const assigned = profileRoles.filter((item) => item.profile_id === person.id).map((item) => item.role);
    return (["AUTHOR", ...assigned, person.role] as AppRole[]).filter((role, index, all) => all.indexOf(role) === index);
  }
  async function toggleRole(person: Profile, role: Exclude<AppRole, "AUTHOR">, checked: boolean) {
    const currentRoles = rolesFor(person);
    const nextRoles = checked ? [...currentRoles, role] : currentRoles.filter((item) => item !== role);
    setUpdatingUserId(person.id); setMessage("");
    const { error } = await getSupabaseClient().rpc("set_user_roles", { target_user_id: person.id, new_roles: nextRoles });
    if (error) setMessage(error.message); else { setMessage(`${person.full_name || person.email}님의 역할을 저장했습니다.`); await onChanged(); }
    setUpdatingUserId(null);
  }
  async function changeActivation(person: Profile, makeActive: boolean) { const { error } = await getSupabaseClient().rpc("set_user_activation", { target_user_id: person.id, make_active: makeActive, change_note: makeActive ? "관리자 회원가입 승인" : "관리자 계정 이용중지" }); if (error) setMessage(error.message); else { setMessage(makeActive ? "회원가입을 승인했습니다." : "계정 이용을 중지했습니다."); await onChanged(); } }
  const orderedProfiles = [...profiles].sort((a, b) => Number(a.is_active) - Number(b.is_active) || b.created_at.localeCompare(a.created_at));
  return <section className="workspace-card"><div className="card-heading"><div><p>MEMBER APPROVAL &amp; MULTIPLE ROLES</p><h2>가입 승인·중복 역할 관리</h2></div><span>승인대기 {profiles.filter((person) => !person.is_active).length}명</span></div>{message && <div className="notice-box">{message}</div>}<div className="data-table-wrap"><table className="data-table member-table"><thead><tr><th>사용자</th><th>소속</th><th>가입상태</th><th>역할 중복 부여</th><th>가입일</th><th>관리</th></tr></thead><tbody>{orderedProfiles.map((person) => {
    const assignedRoles = rolesFor(person);
    const updating = updatingUserId === person.id;
    return <tr key={person.id}><td><b>{person.full_name || "이름 미입력"}</b><small>{person.email}</small></td><td>{person.affiliation ?? "—"}</td><td><span className={`member-status ${person.is_active ? "approved" : "pending"}`}>{person.is_active ? "승인완료" : "승인대기"}</span></td><td><div className="role-checkboxes"><label><input type="checkbox" checked readOnly disabled />투고자</label>{(["REVIEWER", "EDITOR", "ADMIN"] as const).map((role) => <label key={role}><input type="checkbox" checked={assignedRoles.includes(role)} disabled={updating || (person.id === currentUserId && role === "ADMIN")} onChange={(event) => void toggleRole(person, role, event.target.checked)} />{ROLE_LABELS[role]}</label>)}</div></td><td>{formatDate(person.created_at)}</td><td>{!person.is_active ? <button className="primary-small" type="button" disabled={updating} onClick={() => void changeActivation(person, true)}>선택 역할로 가입 승인</button> : person.id !== currentUserId ? <button className="secondary-small" type="button" disabled={updating} onClick={() => void changeActivation(person, false)}>이용중지</button> : <span className="muted-text">현재 관리자</span>}</td></tr>;
  })}</tbody></table></div></section>;
}

function IssueManagement({ issues, onChanged }: { issues: Issue[]; onChanged: () => Promise<void> }) {
  const [message, setMessage] = useState("");
  async function createIssue(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const { error } = await getSupabaseClient().from("issues").insert({ year: Number(form.get("year")), volume: Number(form.get("volume")), issue_number: Number(form.get("issueNumber")), title: String(form.get("title") || "") || null, publication_date: String(form.get("publicationDate") || "") || null }); if (error) setMessage(error.message); else { event.currentTarget.reset(); setMessage("발행호를 생성했습니다."); await onChanged(); } }
  async function toggleIssue(issue: Issue) { const { error } = await getSupabaseClient().from("issues").update({ status: issue.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }).eq("id", issue.id); if (error) setMessage(error.message); else await onChanged(); }
  return <div className="split-workspace"><section className="workspace-card"><div className="card-heading"><div><p>ISSUES</p><h2>발행호 관리</h2></div><span>{issues.length}개</span></div>{issues.map((issue) => <article className="issue-row" key={issue.id}><div><strong>제{issue.volume}권 제{issue.issue_number}호</strong><span>{issue.title || `${issue.year}년 발행호`}</span><small>{issue.publication_date ?? "발행일 미정"}</small></div><button type="button" onClick={() => void toggleIssue(issue)}>{issue.status === "PUBLISHED" ? "비공개 전환" : "발행 공개"}</button></article>)}</section><section className="workspace-card"><div className="card-heading"><div><p>NEW ISSUE</p><h2>발행호 생성</h2></div></div><form className="stack-form" onSubmit={createIssue}><label>연도<input name="year" type="number" defaultValue={new Date().getFullYear()} required /></label><label>권<input name="volume" type="number" min="1" required /></label><label>호<input name="issueNumber" type="number" min="1" required /></label><label>발행호 제목<input name="title" /></label><label>발행예정일<input name="publicationDate" type="date" /></label><button className="button button-primary">발행호 저장</button>{message && <p className="form-message">{message}</p>}</form></section></div>;
}

function PublicationForm({ manuscript, issues, onChanged }: { manuscript: Manuscript; issues: Issue[]; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function publish(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const file = form.get("pdf"); if (!(file instanceof File) || !file.size) return; setBusy(true); setMessage(""); try { const uploaded = await uploadJournalFile(file, manuscript.id, "PUBLISHED", manuscript.round_no); const { error } = await getSupabaseClient().from("published_articles").insert({ manuscript_id: manuscript.id, issue_id: String(form.get("issueId")), article_order: Number(form.get("articleOrder")), page_start: Number(form.get("pageStart")) || null, page_end: Number(form.get("pageEnd")) || null, doi: String(form.get("doi") || "") || null, title_ko: manuscript.title_ko, title_en: manuscript.title_en, abstract_ko: manuscript.abstract_ko, abstract_en: manuscript.abstract_en, keywords_ko: manuscript.keywords_ko, keywords_en: manuscript.keywords_en, pdf_file_id: uploaded.id }); if (error) throw error; const advance = await getSupabaseClient().rpc("advance_manuscript_status", { target_manuscript_id: manuscript.id, next_status: "PUBLISHED", change_note: "발행호 배정 및 최종 PDF 등록" }); if (advance.error) throw advance.error; await onChanged(); setMessage("발행호 배정과 발행처리를 완료했습니다."); } catch (error) { setMessage(getErrorMessage(error)); } finally { setBusy(false); } }
  return <section className="detail-section publication-section"><h3>최종 발행처리</h3><form className="form-grid" onSubmit={publish}><label>발행호<select name="issueId" required defaultValue=""><option value="" disabled>발행호 선택</option>{issues.map((issue) => <option key={issue.id} value={issue.id}>제{issue.volume}권 제{issue.issue_number}호 · {issue.year}</option>)}</select></label><label>논문 순서<input name="articleOrder" type="number" min="1" required /></label><label>시작 페이지<input name="pageStart" type="number" min="1" /></label><label>종료 페이지<input name="pageEnd" type="number" min="1" /></label><label className="wide">DOI<input name="doi" /></label><label className="wide">발행 PDF<input name="pdf" type="file" accept="application/pdf,.pdf" required /></label><div className="form-actions wide"><button className="button button-primary" disabled={busy}>{busy ? "발행 처리 중…" : "발행호 배정·발행완료"}</button>{message && <span>{message}</span>}</div></form></section>;
}
