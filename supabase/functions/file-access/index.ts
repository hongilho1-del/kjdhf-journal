import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedKinds = {
  ORIGINAL: { bucket: "manuscripts", maxBytes: 52_428_800, anonymized: false },
  ANONYMIZED: { bucket: "manuscripts", maxBytes: 52_428_800, anonymized: true },
  REVISION: { bucket: "revisions", maxBytes: 52_428_800, anonymized: true },
  FINAL: { bucket: "final-files", maxBytes: 52_428_800, anonymized: false },
  REVIEW_ATTACHMENT: { bucket: "review-files", maxBytes: 20_971_520, anonymized: false },
  PUBLISHED: { bucket: "published", maxBytes: 52_428_800, anonymized: false },
} as const;

type FileKind = keyof typeof allowedKinds;
type AppRole = "AUTHOR" | "REVIEWER" | "EDITOR" | "ADMIN";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function safeExtension(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension && extension.length <= 8 ? extension : "bin";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Server configuration error" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401);
  const userId = userData.user.id;

  const { data: profile } = await service
    .from("profiles")
    .select("role,is_active")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.is_active) return json({ error: "Active profile required" }, 403);
  const role = profile.role as AppRole;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const manuscriptId = String(form.get("manuscript_id") ?? "");
    const fileKind = String(form.get("file_kind") ?? "") as FileKind;
    const versionNo = Number(form.get("version_no") ?? 1);

    if (!(file instanceof File) || !manuscriptId || !(fileKind in allowedKinds)) {
      return json({ error: "Invalid upload request" }, 400);
    }
    const rule = allowedKinds[fileKind];
    if (!Number.isInteger(versionNo) || versionNo < 1 || file.size < 1 || file.size > rule.maxBytes) {
      return json({ error: "File size or version is invalid" }, 400);
    }

    const { data: manuscript } = await service
      .from("manuscripts")
      .select("id,created_by,status")
      .eq("id", manuscriptId)
      .maybeSingle();
    if (!manuscript) return json({ error: "Manuscript not found" }, 404);

    let authorized = false;
    if (role === "ADMIN" || role === "EDITOR") {
      authorized = fileKind !== "PUBLISHED" || role === "ADMIN";
    } else if (role === "AUTHOR" && manuscript.created_by === userId) {
      authorized =
        (["ORIGINAL", "ANONYMIZED"].includes(fileKind) && manuscript.status === "DRAFT") ||
        (fileKind === "REVISION" && manuscript.status === "REVISION_REQUESTED") ||
        (fileKind === "FINAL" && ["ACCEPTED", "ACCEPT_WITH_REVISIONS"].includes(manuscript.status));
    } else if (role === "REVIEWER" && fileKind === "REVIEW_ATTACHMENT") {
      const { data: assignment } = await service
        .from("reviewer_assignments")
        .select("id")
        .eq("manuscript_id", manuscriptId)
        .eq("reviewer_id", userId)
        .eq("status", "ACCEPTED")
        .maybeSingle();
      authorized = Boolean(assignment);
    }
    if (!authorized) return json({ error: "File upload is not permitted" }, 403);

    const extension = safeExtension(file.name);
    const path = `${manuscriptId}/${versionNo}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await service.storage.from(rule.bucket).upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) return json({ error: uploadError.message }, 400);

    const { data: record, error: recordError } = await service
      .from("manuscript_files")
      .insert({
        manuscript_id: manuscriptId,
        bucket_id: rule.bucket,
        storage_path: path,
        file_kind: fileKind,
        version_no: versionNo,
        original_name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        is_anonymized: rule.anonymized,
        uploaded_by: userId,
      })
      .select("id,bucket_id,storage_path,file_kind,version_no,mime_type,size_bytes,created_at")
      .single();

    if (recordError) {
      await service.storage.from(rule.bucket).remove([path]);
      return json({ error: recordError.message }, 400);
    }
    return json({ file: record }, 201);
  }

  const body = await request.json().catch(() => null) as { action?: string; file_id?: string } | null;
  if (body?.action !== "signed-url" || !body.file_id) return json({ error: "Invalid request" }, 400);

  const { data: fileRecord } = await service
    .from("manuscript_files")
    .select("id,manuscript_id,bucket_id,storage_path,file_kind,is_anonymized,uploaded_by,manuscripts!inner(created_by)")
    .eq("id", body.file_id)
    .maybeSingle();
  if (!fileRecord) return json({ error: "File not found" }, 404);

  const manuscript = Array.isArray(fileRecord.manuscripts)
    ? fileRecord.manuscripts[0]
    : fileRecord.manuscripts;
  let authorized = role === "EDITOR" || role === "ADMIN";
  if (role === "AUTHOR") {
    authorized = manuscript?.created_by === userId && fileRecord.file_kind !== "REVIEW_ATTACHMENT";
  } else if (role === "REVIEWER") {
    if (fileRecord.file_kind === "REVIEW_ATTACHMENT") {
      authorized = fileRecord.uploaded_by === userId;
    } else if (fileRecord.is_anonymized && ["ANONYMIZED", "REVISION"].includes(fileRecord.file_kind)) {
      const { data: assignment } = await service
        .from("reviewer_assignments")
        .select("id")
        .eq("manuscript_id", fileRecord.manuscript_id)
        .eq("reviewer_id", userId)
        .in("status", ["INVITED", "ACCEPTED", "COMPLETED"])
        .limit(1)
        .maybeSingle();
      authorized = Boolean(assignment);
    }
  }
  if (!authorized) return json({ error: "File access is not permitted" }, 403);

  if (fileRecord.bucket_id === "published") {
    const { data } = service.storage.from("published").getPublicUrl(fileRecord.storage_path);
    return json({ url: data.publicUrl, expires_in: null });
  }
  const { data: signed, error: signedError } = await service.storage
    .from(fileRecord.bucket_id)
    .createSignedUrl(fileRecord.storage_path, 60);
  if (signedError) return json({ error: signedError.message }, 400);
  return json({ url: signed.signedUrl, expires_in: 60 });
});
