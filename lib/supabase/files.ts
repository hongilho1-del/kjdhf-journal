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
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.file as JournalFileResult;
}

export async function getJournalFileUrl(fileId: string) {
  const { data, error } = await getSupabaseClient().functions.invoke("file-access", {
    body: { action: "signed-url", file_id: fileId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.url as string;
}
