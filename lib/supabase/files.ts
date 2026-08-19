import type { Database } from "./database.types";
import { getSupabaseClient } from "./client";

export type JournalFileKind = Database["public"]["Enums"]["manuscript_file_kind"];

export const MANUSCRIPT_FILE_ACCEPT = ".pdf,.doc,.docx,.hwp,.hwpx,application/vnd.hancom.hwpx";

const FILE_SIZE_LIMITS = {
  ORIGINAL: 52_428_800,
  ANONYMIZED: 52_428_800,
  REVISION: 52_428_800,
  FINAL: 52_428_800,
  REVIEW_ATTACHMENT: 20_971_520,
  PUBLISHED: 52_428_800,
} satisfies Record<JournalFileKind, number>;

export interface JournalFileResult {
  id: string;
  bucket_id: string;
  storage_path: string;
  file_kind: JournalFileKind;
  version_no: number;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

async function functionError(error: unknown) {
  if (typeof error === "object" && error && "context" in error) {
    const context = error.context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { error?: string; message?: string; msg?: string } | null;
      const message = payload?.error || payload?.message || payload?.msg;
      if (message) return new Error(message);
    }
  }
  return error instanceof Error ? error : new Error("파일 요청을 처리하지 못했습니다.");
}

export async function uploadJournalFile(
  file: File,
  manuscriptId: string,
  fileKind: JournalFileKind,
  versionNo: number,
) {
  const maxBytes = FILE_SIZE_LIMITS[fileKind];
  if (!Number.isInteger(versionNo) || versionNo < 1) throw new Error("파일 버전이 올바르지 않습니다.");
  if (!file.size || file.size > maxBytes) throw new Error(`파일 크기는 ${Math.floor(maxBytes / 1024 / 1024)}MB 이하여야 합니다.`);
  const supabase = getSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session?.access_token) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
  const formData = new FormData();
  formData.set("file", file);
  formData.set("manuscript_id", manuscriptId);
  formData.set("file_kind", fileKind);
  formData.set("version_no", String(versionNo));
  const { data, error } = await supabase.functions.invoke("file-access", {
    body: formData,
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });
  if (error) throw await functionError(error);
  if (data?.error) throw new Error(data.error);
  return data.file as JournalFileResult;
}

export async function createJournalReviewCopy(
  file: File,
  _uploaded: JournalFileResult,
  manuscriptId: string,
  versionNo: number,
) {
  return uploadJournalFile(file, manuscriptId, "ANONYMIZED", versionNo);
}

export async function getJournalFileUrl(fileId: string) {
  const { data, error } = await getSupabaseClient().functions.invoke("file-access", {
    body: { action: "signed-url", file_id: fileId },
  });
  if (error) throw await functionError(error);
  if (data?.error) throw new Error(data.error);
  return data.url as string;
}
