"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createManuscriptBackup,
  createReviewerLedger,
  createSubmissionLedger,
  downloadBlob,
  type AdminExportSnapshot,
  type ExportPeriod,
} from "@/lib/admin-export";
import { getErrorMessage, type Manuscript } from "@/lib/journal";
import type { Tables } from "@/lib/supabase/database.types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getJournalFileUrl } from "@/lib/supabase/files";

type ManuscriptFile = Tables<"manuscript_files">;

function initialPeriod(): ExportPeriod {
  const year = new Date().getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function submittedDate(manuscript: Manuscript) {
  return (manuscript.submitted_at ?? manuscript.created_at).slice(0, 10);
}

function periodBounds(period: ExportPeriod) {
  if (!period.start || !period.end || period.start > period.end) throw new Error("시작일과 종료일을 올바르게 선택해 주세요.");
  const start = new Date(`${period.start}T00:00:00+09:00`);
  const end = new Date(`${period.end}T00:00:00+09:00`);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), endExclusive: end.toISOString() };
}

async function loadExportSnapshot(period: ExportPeriod): Promise<AdminExportSnapshot> {
  const supabase = getSupabaseClient();
  const bounds = periodBounds(period);
  const [manuscriptResult, profileResult, issueResult] = await Promise.all([
    supabase.from("manuscripts").select("*").neq("status", "DRAFT").gte("submitted_at", bounds.start).lt("submitted_at", bounds.endExclusive).order("submitted_at"),
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("issues").select("*").order("year").order("issue_number"),
  ]);
  const primaryError = manuscriptResult.error ?? profileResult.error ?? issueResult.error;
  if (primaryError) throw primaryError;
  const manuscripts = manuscriptResult.data ?? [];
  const manuscriptIds = manuscripts.map((item) => item.id);
  if (!manuscriptIds.length) return { manuscripts: [], authors: [], profiles: profileResult.data ?? [], assignments: [], reviews: [], decisions: [], files: [], issues: issueResult.data ?? [], articles: [], statusHistory: [] };
  const [authorResult, assignmentResult, decisionResult, fileResult, articleResult, historyResult] = await Promise.all([
    supabase.from("authors").select("*").in("manuscript_id", manuscriptIds).order("sort_order"),
    supabase.from("reviewer_assignments").select("*").in("manuscript_id", manuscriptIds).order("created_at"),
    supabase.from("editorial_decisions").select("*").in("manuscript_id", manuscriptIds).order("decided_at"),
    supabase.from("manuscript_files").select("*").in("manuscript_id", manuscriptIds).order("created_at"),
    supabase.from("published_articles").select("*").in("manuscript_id", manuscriptIds).order("published_at"),
    supabase.from("manuscript_status_history").select("*").in("manuscript_id", manuscriptIds).order("changed_at"),
  ]);
  const detailError = authorResult.error ?? assignmentResult.error ?? decisionResult.error ?? fileResult.error ?? articleResult.error ?? historyResult.error;
  if (detailError) throw detailError;
  const assignments = assignmentResult.data ?? [];
  const assignmentIds = assignments.map((item) => item.id);
  const reviewResult = assignmentIds.length ? await supabase.from("reviews").select("*").in("assignment_id", assignmentIds).order("submitted_at") : { data: [], error: null };
  if (reviewResult.error) throw reviewResult.error;
  return {
    manuscripts,
    authors: authorResult.data ?? [],
    profiles: profileResult.data ?? [],
    assignments,
    reviews: reviewResult.data ?? [],
    decisions: decisionResult.data ?? [],
    files: fileResult.data ?? [],
    issues: issueResult.data ?? [],
    articles: articleResult.data ?? [],
    statusHistory: historyResult.data ?? [],
  };
}

async function loadPrivateFile(file: ManuscriptFile) {
  const url = await getJournalFileUrl(file.id);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${file.original_name} 파일을 내려받지 못했습니다.`);
  return new Uint8Array(await response.arrayBuffer());
}

export function AdminDataExport({ manuscripts }: { manuscripts: Manuscript[] }) {
  const [period, setPeriod] = useState<ExportPeriod>(initialPeriod);
  const [backupManuscriptId, setBackupManuscriptId] = useState("");
  const [busy, setBusy] = useState<"submission" | "reviewer" | "backup" | null>(null);
  const [message, setMessage] = useState("");
  const eligibleManuscripts = useMemo(() => manuscripts.filter((manuscript) => {
    const date = submittedDate(manuscript);
    return date >= period.start && date <= period.end;
  }), [manuscripts, period.end, period.start]);

  useEffect(() => {
    if (!eligibleManuscripts.some((item) => item.id === backupManuscriptId)) setBackupManuscriptId(eligibleManuscripts[0]?.id ?? "");
  }, [backupManuscriptId, eligibleManuscripts]);

  async function exportLedger(kind: "submission" | "reviewer") {
    setBusy(kind);
    setMessage(kind === "submission" ? "논문투고대장을 만들고 있습니다…" : "심사자대장을 만들고 있습니다…");
    try {
      const snapshot = await loadExportSnapshot(period);
      if (!snapshot.manuscripts.length) throw new Error("선택한 기간에 투고된 논문이 없습니다.");
      const workbook = kind === "submission" ? createSubmissionLedger(snapshot, period) : createReviewerLedger(snapshot, period);
      const label = kind === "submission" ? "논문투고대장" : "심사자대장";
      downloadBlob(workbook, `${period.start}_${period.end}_${label}.xlsx`);
      setMessage(`${label} Excel 파일을 내려받았습니다.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function exportBackup() {
    if (!backupManuscriptId) return setMessage("백업할 논문을 선택해 주세요.");
    setBusy("backup");
    setMessage("논문 정보와 비공개 파일을 안전하게 모으고 있습니다…");
    try {
      const snapshot = await loadExportSnapshot(period);
      const manuscript = snapshot.manuscripts.find((item) => item.id === backupManuscriptId);
      if (!manuscript) throw new Error("선택한 기간에서 해당 논문을 찾을 수 없습니다.");
      const backup = await createManuscriptBackup(snapshot, backupManuscriptId, loadPrivateFile);
      downloadBlob(backup, `${manuscript.manuscript_code ?? manuscript.id}_전체자료.zip`);
      setMessage("선택한 논문의 전체자료 ZIP을 내려받았습니다.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return <section className="workspace-card admin-export-workspace">
    <div className="card-heading"><div><p>ADMINISTRATIVE DATA EXPORT</p><h2>투고·심사자료 내보내기</h2></div><span>관리자 전용</span></div>
    <div className="admin-export-period">
      <label>시작일<input type="date" value={period.start} onChange={(event) => setPeriod((current) => ({ ...current, start: event.target.value }))} /></label>
      <span>~</span>
      <label>종료일<input type="date" value={period.end} onChange={(event) => setPeriod((current) => ({ ...current, end: event.target.value }))} /></label>
      <strong>{eligibleManuscripts.length}건</strong>
    </div>
    <div className="admin-export-grid">
      <article><span>01 · EXCEL</span><h3>논문투고대장</h3><p>관리번호, 투고일, 저자·소속, 연구분야, 담당 편집위원, 심사상태, 최종판정과 게재권호를 정리합니다.</p><button className="button button-primary" type="button" disabled={Boolean(busy)} onClick={() => void exportLedger("submission")}>{busy === "submission" ? "Excel 생성 중…" : "논문투고대장 Excel 다운로드"}</button></article>
      <article><span>02 · EXCEL</span><h3>심사자대장</h3><p>논문별 심사위원, 소속, 의뢰·수락·완료일, 심사판정과 심사차수를 정리합니다.</p><button className="button button-primary" type="button" disabled={Boolean(busy)} onClick={() => void exportLedger("reviewer")}>{busy === "reviewer" ? "Excel 생성 중…" : "심사자대장 Excel 다운로드"}</button></article>
      <article className="admin-export-backup"><span>03 · SECURE ZIP</span><h3>논문별 전체자료 ZIP</h3><p>저자정보, 심사결과, 편집판정, 상태이력과 투고·수정·최종·심사첨부 파일을 하나로 백업합니다.</p><label>백업 논문<select value={backupManuscriptId} onChange={(event) => setBackupManuscriptId(event.target.value)} disabled={Boolean(busy)}><option value="">논문 선택</option>{eligibleManuscripts.map((manuscript) => <option value={manuscript.id} key={manuscript.id}>{manuscript.manuscript_code} · {manuscript.title_ko}</option>)}</select></label><button className="button button-primary" type="button" disabled={Boolean(busy) || !backupManuscriptId} onClick={() => void exportBackup()}>{busy === "backup" ? "ZIP 백업 생성 중…" : "선택 논문 전체자료 ZIP 다운로드"}</button></article>
    </div>
    <div className="admin-export-note"><strong>보안 안내</strong><p>ZIP에는 저자 개인정보와 편집위원 전용 심사의견이 포함될 수 있습니다. 관리자만 내려받아 암호화된 기관 저장소에 보관해 주세요. 논문유형은 현재 시스템 기본값인 ‘연구논문’으로 출력됩니다.</p></div>
    {message && <div className="notice-box" role="status">{message}</div>}
  </section>;
}
