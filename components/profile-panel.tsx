"use client";

import { useState, type FormEvent } from "react";
import { getErrorMessage, ROLE_LABELS, type AppRole, type Profile } from "@/lib/journal";
import { getSupabaseClient } from "@/lib/supabase/client";

export function ProfilePanel({ profile, roles, onSaved }: { profile: Profile; roles: AppRole[]; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const { error } = await getSupabaseClient().rpc("update_my_profile", {
        new_full_name: String(form.get("fullName") ?? ""),
        new_affiliation: String(form.get("affiliation") ?? ""),
        new_phone: String(form.get("phone") ?? ""),
        new_research_fields: String(form.get("researchFields") ?? "").split(/[,;]/).map((value) => value.trim()).filter(Boolean),
        new_reviewer_bio: String(form.get("reviewerBio") ?? ""),
      });
      if (error) throw error;
      await onSaved();
      setMessage("개인정보를 저장했습니다.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-card profile-card">
      <div className="card-heading"><div><p>MY PROFILE</p><h2>개인정보 수정</h2></div><span className="role-chip">{roles.map((role) => ROLE_LABELS[role]).join(" · ")}</span></div>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>이름<input name="fullName" defaultValue={profile.full_name} required /></label>
        <label>이메일<input value={profile.email} readOnly aria-describedby="email-help" /><small id="email-help">로그인 이메일은 관리자에게 변경을 요청해 주세요.</small></label>
        <label>소속<input name="affiliation" defaultValue={profile.affiliation ?? ""} /></label>
        <label>연락처<input name="phone" defaultValue={profile.phone ?? ""} /></label>
        <label className="wide">연구분야<input name="researchFields" defaultValue={profile.research_fields.join(", ")} placeholder="운동생리, 건강체력, 디지털헬스" /></label>
        {roles.includes("REVIEWER") && <label className="wide">심사 전문분야<textarea name="reviewerBio" defaultValue={profile.reviewer_bio ?? ""} rows={4} /></label>}
        <div className="form-actions wide"><button className="button button-primary" disabled={busy}>{busy ? "저장 중…" : "변경사항 저장"}</button>{message && <span role="status">{message}</span>}</div>
      </form>
    </section>
  );
}
