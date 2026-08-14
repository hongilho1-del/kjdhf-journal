import { strToU8, zipSync, type Zippable } from "fflate";
import { DECISION_LABELS, RECOMMENDATION_LABELS, STATUS_LABELS } from "@/lib/journal";
import type { Tables } from "@/lib/supabase/database.types";

type Manuscript = Tables<"manuscripts">;
type Author = Tables<"authors">;
type Profile = Tables<"profiles">;
type Assignment = Tables<"reviewer_assignments">;
type Review = Tables<"reviews">;
type Decision = Tables<"editorial_decisions">;
type ManuscriptFile = Tables<"manuscript_files">;
type Issue = Tables<"issues">;
type PublishedArticle = Tables<"published_articles">;
type StatusHistory = Tables<"manuscript_status_history">;
type CellValue = string | number | Date | null | undefined;

export type ExportPeriod = { start: string; end: string };

export type AdminExportSnapshot = {
  manuscripts: Manuscript[];
  authors: Author[];
  profiles: Profile[];
  assignments: Assignment[];
  reviews: Review[];
  decisions: Decision[];
  files: ManuscriptFile[];
  issues: Issue[];
  articles: PublishedArticle[];
  statusHistory: StatusHistory[];
};

const assignmentLabels: Record<Assignment["status"], string> = {
  INVITED: "심사의뢰",
  ACCEPTED: "수락",
  DECLINED: "거절",
  COMPLETED: "심사완료",
  CANCELLED: "취소",
};

const fileFolderLabels: Record<ManuscriptFile["file_kind"], string> = {
  ORIGINAL: "01_투고원고",
  ANONYMIZED: "02_익명심사용원고",
  REVISION: "03_수정원고_및_답변자료",
  REVIEW_ATTACHMENT: "04_심사의견서",
  FINAL: "05_최종원고",
  PUBLISHED: "06_발행파일",
};

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function excelDate(value: Date) {
  return value.getTime() / 86_400_000 + 25_569;
}

function dateCell(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function textWidth(value: CellValue) {
  const text = value instanceof Date ? "yyyy-mm-dd" : String(value ?? "");
  return [...text].reduce((width, character) => width + (/[^\x00-\x7F]/.test(character) ? 2 : 1), 0);
}

function cellXml(value: CellValue, row: number, column: number, style = 0) {
  const reference = `${columnName(column)}${row}`;
  if (value instanceof Date) return `<c r="${reference}" s="2" t="n"><v>${excelDate(value).toFixed(8)}</v></c>`;
  if (typeof value === "number") return `<c r="${reference}" s="${style}" t="n"><v>${value}</v></c>`;
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function createWorkbook(title: string, period: ExportPeriod, headers: string[], rows: CellValue[][]) {
  const lastColumn = columnName(headers.length - 1);
  const widths = headers.map((header, column) => {
    const contentWidth = rows.reduce((maximum, row) => Math.max(maximum, textWidth(row[column])), textWidth(header));
    return Math.min(46, Math.max(12, contentWidth + 3));
  });
  const columns = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const headerCells = headers.map((header, column) => cellXml(header, 3, column, 1)).join("");
  const bodyRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 4}">${headers.map((_, column) => cellXml(row[column], rowIndex + 4, column)).join("")}</row>`).join("");
  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${columns}</cols>
  <sheetData>
    <row r="1" ht="30" customHeight="1">${cellXml(title, 1, 0, 3)}</row>
    <row r="2" ht="22" customHeight="1">${cellXml(`대상 기간: ${period.start} ~ ${period.end} · 생성일: ${new Date().toISOString().slice(0, 10)}`, 2, 0, 4)}</row>
    <row r="3" ht="36" customHeight="1">${headerCells}</row>
    ${bodyRows}
  </sheetData>
  <autoFilter ref="A3:${lastColumn}${Math.max(3, rows.length + 3)}"/>
  <mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells>
  <pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
</worksheet>`;
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>
  <fonts count="4">
    <font><sz val="10"/><name val="맑은 고딕"/></font>
    <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="맑은 고딕"/></font>
    <font><b/><color rgb="FF0B2D5C"/><sz val="17"/><name val="맑은 고딕"/></font>
    <font><color rgb="FF5E6B78"/><sz val="9"/><name val="맑은 고딕"/></font>
  </fonts>
  <fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0B2D5C"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F7"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border/><border><left style="thin"><color rgb="FFD7E0E8"/></left><right style="thin"><color rgb="FFD7E0E8"/></right><top style="thin"><color rgb="FFD7E0E8"/></top><bottom style="thin"><color rgb="FFD7E0E8"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
  const workbookFiles: Zippable = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`),
    "docProps/core.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(title)}</dc:title><dc:creator>한국디지털건강체력연구</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`),
    "docProps/app.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>한국디지털건강체력연구 온라인 투고·심사 시스템</Application></Properties>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(title)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    "xl/styles.xml": strToU8(stylesXml),
    "xl/worksheets/sheet1.xml": strToU8(sheetXml),
  };
  return bytesToBlob(zipSync(workbookFiles, { level: 6 }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

function profileName(snapshot: AdminExportSnapshot, profileId: string | null | undefined) {
  if (!profileId) return "";
  const profile = snapshot.profiles.find((item) => item.id === profileId);
  return profile?.full_name || profile?.email || "";
}

function uniqueText(values: (string | null | undefined)[]) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].join(", ");
}

function finalDecision(snapshot: AdminExportSnapshot, manuscriptId: string) {
  return snapshot.decisions.filter((item) => item.manuscript_id === manuscriptId).sort((a, b) => b.decided_at.localeCompare(a.decided_at))[0];
}

function assignedEditors(snapshot: AdminExportSnapshot, manuscriptId: string) {
  const assignmentEditors = snapshot.assignments.filter((item) => item.manuscript_id === manuscriptId).map((item) => profileName(snapshot, item.assigned_by));
  const decisionEditors = snapshot.decisions.filter((item) => item.manuscript_id === manuscriptId).map((item) => profileName(snapshot, item.decided_by));
  return uniqueText([...assignmentEditors, ...decisionEditors]);
}

export function createSubmissionLedger(snapshot: AdminExportSnapshot, period: ExportPeriod) {
  const headers = ["관리번호", "투고일", "논문명(국문)", "논문명(영문)", "저자", "교신저자", "소속", "논문유형", "연구분야", "담당편집위원", "현재상태", "최종판정", "판정일", "게재권호", "게재일", "DOI"];
  const issueById = new Map(snapshot.issues.map((issue) => [issue.id, issue]));
  const articleByManuscript = new Map(snapshot.articles.map((article) => [article.manuscript_id, article]));
  const rows = snapshot.manuscripts.map((manuscript) => {
    const authors = snapshot.authors.filter((item) => item.manuscript_id === manuscript.id).sort((a, b) => a.sort_order - b.sort_order);
    const corresponding = authors.find((author) => author.is_corresponding);
    const decision = finalDecision(snapshot, manuscript.id);
    const article = articleByManuscript.get(manuscript.id);
    const issue = article ? issueById.get(article.issue_id) : undefined;
    return [
      manuscript.manuscript_code ?? "",
      dateCell(manuscript.submitted_at),
      manuscript.title_ko,
      manuscript.title_en,
      authors.map((author) => author.name_ko).join(", "),
      corresponding?.name_ko ?? "",
      uniqueText(authors.map((author) => author.affiliation_ko)),
      "연구논문",
      manuscript.research_field,
      assignedEditors(snapshot, manuscript.id),
      STATUS_LABELS[manuscript.status],
      decision ? DECISION_LABELS[decision.decision] : "",
      dateCell(decision?.decided_at),
      issue ? `${issue.year}년 제${issue.volume}권 제${issue.issue_number}호` : "",
      dateCell(article?.published_at),
      article?.doi ?? "",
    ];
  });
  return createWorkbook("논문투고대장", period, headers, rows);
}

export function createReviewerLedger(snapshot: AdminExportSnapshot, period: ExportPeriod) {
  const headers = ["관리번호", "논문명", "심사위원", "소속", "심사의뢰일", "수락·거절일", "심사완료일", "심사기한", "배정상태", "심사판정", "심사차수", "배정편집위원"];
  const manuscriptById = new Map(snapshot.manuscripts.map((manuscript) => [manuscript.id, manuscript]));
  const reviewByAssignment = new Map(snapshot.reviews.map((review) => [review.assignment_id, review]));
  const profileById = new Map(snapshot.profiles.map((profile) => [profile.id, profile]));
  const rows = snapshot.assignments.map((assignment) => {
    const manuscript = manuscriptById.get(assignment.manuscript_id);
    const reviewer = profileById.get(assignment.reviewer_id);
    const review = reviewByAssignment.get(assignment.id);
    return [
      manuscript?.manuscript_code ?? "",
      manuscript?.title_ko ?? "",
      reviewer?.full_name ?? "",
      reviewer?.affiliation ?? "",
      dateCell(assignment.created_at),
      dateCell(assignment.responded_at),
      dateCell(review?.submitted_at),
      dateCell(assignment.due_at),
      assignmentLabels[assignment.status],
      review?.recommendation ? RECOMMENDATION_LABELS[review.recommendation] : "",
      assignment.round_no,
      profileName(snapshot, assignment.assigned_by),
    ];
  });
  return createWorkbook("심사자대장", period, headers, rows);
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function csvFile(headers: string[], rows: unknown[][]) {
  return strToU8(`\uFEFF${[headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n")}`);
}

function safeFileName(value: string) {
  const cleaned = value.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_").replace(/\s+/g, " ").trim();
  return cleaned || "파일";
}

function bytesToBlob(bytes: Uint8Array, type: string) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([buffer], { type });
}

export async function createManuscriptBackup(
  snapshot: AdminExportSnapshot,
  manuscriptId: string,
  loadFile: (file: ManuscriptFile) => Promise<Uint8Array>,
) {
  const manuscript = snapshot.manuscripts.find((item) => item.id === manuscriptId);
  if (!manuscript) throw new Error("백업할 논문을 찾을 수 없습니다.");
  const authors = snapshot.authors.filter((item) => item.manuscript_id === manuscriptId).sort((a, b) => a.sort_order - b.sort_order);
  const assignments = snapshot.assignments.filter((item) => item.manuscript_id === manuscriptId).sort((a, b) => a.round_no - b.round_no || a.created_at.localeCompare(b.created_at));
  const assignmentIds = new Set(assignments.map((item) => item.id));
  const reviews = snapshot.reviews.filter((item) => assignmentIds.has(item.assignment_id));
  const decisions = snapshot.decisions.filter((item) => item.manuscript_id === manuscriptId).sort((a, b) => a.decided_at.localeCompare(b.decided_at));
  const history = snapshot.statusHistory.filter((item) => item.manuscript_id === manuscriptId).sort((a, b) => a.changed_at.localeCompare(b.changed_at));
  const files = snapshot.files.filter((item) => item.manuscript_id === manuscriptId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const article = snapshot.articles.find((item) => item.manuscript_id === manuscriptId);
  const issue = article ? snapshot.issues.find((item) => item.id === article.issue_id) : undefined;
  const reviewerByAssignment = new Map(assignments.map((assignment) => [assignment.id, snapshot.profiles.find((profile) => profile.id === assignment.reviewer_id)]));
  const zipFiles: Zippable = {
    "00_백업안내.txt": strToU8(`한국디지털건강체력연구 논문별 전체자료 백업\n관리번호: ${manuscript.manuscript_code ?? manuscript.id}\n생성시각: ${new Date().toISOString()}\n\n이 ZIP에는 저자 개인정보, 비공개 심사의견 및 편집 메모가 포함될 수 있으므로 관리자만 안전하게 보관해야 합니다.`),
    "01_논문정보/논문정보.json": strToU8(JSON.stringify({ manuscript, publication: article ? { article, issue } : null }, null, 2)),
    "01_논문정보/저자목록.csv": csvFile(["저자순서", "국문명", "영문명", "소속(국문)", "소속(영문)", "이메일", "교신저자"], authors.map((author) => [author.sort_order, author.name_ko, author.name_en, author.affiliation_ko, author.affiliation_en, author.email, author.is_corresponding ? "Y" : "N"])),
    "02_심사/심사위원배정.json": strToU8(JSON.stringify(assignments.map((assignment) => ({ ...assignment, reviewer: reviewerByAssignment.get(assignment.id) ?? null })), null, 2)),
    "02_심사/심사결과.json": strToU8(JSON.stringify(reviews.map((review) => ({ ...review, reviewer: reviewerByAssignment.get(review.assignment_id) ?? null })), null, 2)),
    "03_편집/편집판정.json": strToU8(JSON.stringify(decisions.map((decision) => ({ ...decision, decided_by_profile: snapshot.profiles.find((profile) => profile.id === decision.decided_by) ?? null })), null, 2)),
    "03_편집/상태변경이력.json": strToU8(JSON.stringify(history, null, 2)),
  };
  reviews.forEach((review, index) => {
    const assignment = assignments.find((item) => item.id === review.assignment_id);
    const reviewer = reviewerByAssignment.get(review.assignment_id);
    const recommendation = review.recommendation ? RECOMMENDATION_LABELS[review.recommendation] : "미제출";
    zipFiles[`02_심사/${String(index + 1).padStart(2, "0")}_${assignment?.round_no ?? 0}차_${safeFileName(reviewer?.full_name ?? "심사위원")}_심사결과.txt`] = strToU8(`심사위원: ${reviewer?.full_name ?? ""}\n소속: ${reviewer?.affiliation ?? ""}\n심사차수: ${assignment?.round_no ?? ""}\n판정: ${recommendation}\n제출일: ${review.submitted_at ?? ""}\n\n[저자 공개용 의견]\n${review.author_comments}\n\n[편집위원 전용 의견]\n${review.editor_comments}`);
  });
  for (const [index, file] of files.entries()) {
    const bytes = await loadFile(file);
    const folder = fileFolderLabels[file.file_kind];
    const fileName = `${String(index + 1).padStart(2, "0")}_v${file.version_no}_${safeFileName(file.original_name)}`;
    zipFiles[`04_파일/${folder}/${fileName}`] = bytes;
  }
  return bytesToBlob(zipSync(zipFiles, { level: 6 }), "application/zip");
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFileName(fileName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
