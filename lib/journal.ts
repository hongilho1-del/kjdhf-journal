import type { Database, Tables } from "./supabase/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type ManuscriptStatus = Database["public"]["Enums"]["manuscript_status"];
export type ReviewRecommendation = Database["public"]["Enums"]["review_recommendation"];
export type EditorialDecision = Database["public"]["Enums"]["editorial_decision_type"];
export type Profile = Tables<"profiles">;
export type Manuscript = Tables<"manuscripts">;
export type Assignment = Tables<"reviewer_assignments">;
export type Review = Tables<"reviews">;

export const ROLE_LABELS: Record<AppRole, string> = {
  AUTHOR: "저자",
  REVIEWER: "심사위원",
  EDITOR: "편집위원",
  ADMIN: "편집관리자",
};

export const STATUS_LABELS: Record<ManuscriptStatus, string> = {
  DRAFT: "작성중",
  SUBMITTED: "신규투고",
  RECEIVED: "접수확인",
  FORMAT_REVIEW: "형식검토",
  REVIEWER_SELECTION: "심사위원선정",
  UNDER_REVIEW: "심사중",
  REVISION_REQUESTED: "수정요청",
  REVISION_SUBMITTED: "수정본제출",
  RE_REVIEW: "재심사중",
  ACCEPTED: "게재가",
  ACCEPT_WITH_REVISIONS: "수정후게재",
  REJECTED: "게재불가",
  FINAL_ACCEPTED: "게재확정",
  PUBLISHED: "발행완료",
};

export const RECOMMENDATION_LABELS: Record<ReviewRecommendation, string> = {
  ACCEPT: "게재가",
  ACCEPT_WITH_REVISIONS: "수정후게재",
  RE_REVIEW: "수정후재심",
  REJECT: "게재불가",
};

export const DECISION_LABELS: Record<EditorialDecision, string> = {
  REVISION_REQUESTED: "수정요청",
  ACCEPTED: "게재가",
  ACCEPT_WITH_REVISIONS: "수정후게재",
  REJECTED: "게재불가",
  FINAL_ACCEPTED: "게재확정",
};

export const STATUS_GROUPS = {
  new: ["SUBMITTED", "RECEIVED", "FORMAT_REVIEW"] as ManuscriptStatus[],
  assignment: ["REVIEWER_SELECTION"] as ManuscriptStatus[],
  reviewing: ["UNDER_REVIEW", "RE_REVIEW"] as ManuscriptStatus[],
  revision: ["REVISION_REQUESTED", "REVISION_SUBMITTED", "ACCEPT_WITH_REVISIONS"] as ManuscriptStatus[],
  accepted: ["ACCEPTED", "FINAL_ACCEPTED", "PUBLISHED"] as ManuscriptStatus[],
  rejected: ["REJECTED"] as ManuscriptStatus[],
};

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function splitKeywords(value: string) {
  return value.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
