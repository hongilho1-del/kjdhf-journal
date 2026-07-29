"use client";

import { useState, type FormEvent } from "react";
import { getErrorMessage } from "@/lib/journal";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AuthPanel({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "").trim();
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseClient();
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.href.split("#")[0],
          },
        });
        if (error) throw error;
        if (data.session) await supabase.auth.signOut();
        setMessage("가입 신청이 접수되었습니다. 이메일 인증과 관리자 승인 후 로그인할 수 있습니다.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="닫기">×</button>
        <p className="panel-eyebrow">KJDHF ACCOUNT</p>
        <h2 id="auth-title">{mode === "login" ? "시스템 로그인" : "저자 회원가입 신청"}</h2>
        <p className="panel-description">
          {mode === "login"
            ? "등록된 계정으로 논문투고·심사 업무를 계속하세요."
            : "신규 계정은 저자 권한으로 신청되며, 이메일 인증과 관리자의 가입 승인 후 이용할 수 있습니다."}
        </p>

        {!isSupabaseConfigured && (
          <div className="notice-box error">Supabase 공개 환경변수가 설정되지 않았습니다.</div>
        )}

        <form className="stack-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <label>이름<input name="fullName" autoComplete="name" required minLength={2} /></label>
          )}
          <label>이메일<input name="email" type="email" autoComplete="email" required /></label>
          <label>비밀번호<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} /></label>
          <button className="button button-primary form-submit" disabled={busy || !isSupabaseConfigured}>
            {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입 신청"}
          </button>
        </form>
        {message && <p className="form-message" role="status">{message}</p>}
        <button className="mode-switch" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
          {mode === "login" ? "처음 방문하셨나요? 저자 회원가입" : "이미 계정이 있나요? 로그인"}
        </button>
      </section>
    </div>
  );
}
