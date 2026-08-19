import type { Database } from "./database.types";
import { getSupabaseClient } from "./client";

export type JournalFileKind = Database["public"]["Enums"]["manuscript_file_kind"];

export const MANUSCRIPT_FILE_ACCEPT = ".pdf,.doc,.docx,.hwp,.hwpx,application/vnd.hancom.hwpx";

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
      const payload = await context.clone().json().catch(() => null) as { error?: string; message?: string } | null;
      const message = payload?.error || payload?.message;
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
  const formData = new FormData();
  formData.set("file", file);
  formData.set("manuscript_id", manuscriptId);
  formData.set("file_kind", fileKind);
  formData.set("version_no", String(versionNo));

  const { data, error } = await getSupabaseClient().functions.invoke("file-access", {
    body: formData,
  });
  if (error) throw await functionError(error);
  if (data?.error) throw new Error(data.error);
  return data.file as JournalFileResult;
}

export async function createJournalReviewCopy(
  file: File,
  uploaded: JournalFileResult,
  manuscriptId: string,
  versionNo: number,
) {
  const supabase = getSupabaseClient();
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const reviewPath = `${manuscriptId}/${versionNo}/${crypto.randomUUID()}.${extension}`;
  const { error: copyError } = await supabase.storage.from("manuscripts").copy(uploaded.storage_path, reviewPath);
  if (copyError) throw copyError;
  const { data, error } = await supabase.from("manuscript_files").insert({
    manuscript_id: manuscriptId,
    bucket_id: "manuscripts",
    storage_path: reviewPath,
    file_kind: "ANONYMIZED",
    version_no: versionNo,
    original_name: file.name,
    mime_type: file.type || "application/octet-stream",
    size_bytes: file.size,
    is_anonymized: true,
  }).select("id,bucket_id,storage_path,file_kind,version_no,mime_type,size_bytes,created_at").single();
  if (error) {
    await supabase.storage.from("manuscripts").remove([reviewPath]);
    throw error;
  }
  return data as JournalFileResult;
}

export async function getJournalFileUrl(fileId: string) {
  const { data, error } = await getSupabaseClient().functions.invoke("file-access", {
    body: { action: "signed-url", file_id: fileId },
  });
  if (error) throw await functionError(error);
  if (data?.error) throw new Error(data.error);
  return data.url as string;
}
