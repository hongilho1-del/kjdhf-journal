"use client";

import { useState, type FormEvent } from "react";
import { getErrorMessage } from "@/lib/journal";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AuthPanel({ onClose, adminLogin = false, initialMode = "login" }: { onClose: () => void; adminLogin?: boolean; initialMode?: "login" | "signup" }) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [signupStep, setSignupStep] = useState<1 | 2 | 3 | 4>(1);
  const [memberType, setMemberType] = useState<"individual" | null>(null);
  const [agreements, setAgreements] = useState({ service: false, privacy: false, age: false });
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const passwordConfirm = String(form.get("passwordConfirm") ?? "");
    const fullName = String(form.get("fullName") ?? "").trim();
    const affiliation = String(form.get("affiliation") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const researchFields = String(form.get("researchFields") ?? "").split(/[,;]/).map((value) => value.trim()).filter(Boolean);
    setBusy(true);
    setMessage("");
    try {
      const supabase = getSupabaseClient();
      if (mode === "signup") {
        if (!Object.values(agreements).every(Boolean)) throw new Error("필수 약관에 모두 동의해 주세요.");
        if (password !== passwordConfirm) throw new Error("비밀번호 확인이 일치하지 않습니다.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, affiliation, phone, research_fields: researchFields },
            emailRedirectTo: window.location.href.split("#")[0],
          },
        });
        if (error) throw error;
        if (data.session) await supabase.auth.signOut();
        setRegisteredEmail(email);
        setSignupStep(4);
      } else if (adminLogin) {
        const { data, error } = await supabase.functions.invoke("admin-login", {
          body: { username, password },
        });
        if (error || !data?.access_token || !data?.refresh_token) {
          throw new Error("관리자 아이디 또는 비밀번호를 확인해 주세요.");
        }
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (sessionError) throw sessionError;
        onClose();
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.user) throw new Error("로그인 정보를 확인해 주세요.");
        onClose();
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`modal-backdrop ${mode === "signup" ? "signup-backdrop" : ""}`} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`auth-panel ${mode === "signup" ? "signup-panel" : ""}`} role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="닫기">×</button>
        <p className="panel-eyebrow">{adminLogin ? "KJDHF ADMINISTRATION" : "KJDHF ACCOUNT"}</p>
        <h2 id="auth-title">{adminLogin ? "관리자 로그인" : mode === "login" ? "시스템 로그인" : "회원가입"}</h2>
        <p className="panel-description">
          {adminLogin
            ? "별도로 발급된 관리자 아이디와 비밀번호를 입력하세요. 계정 이메일은 로그인 화면에 사용하지 않습니다."
            : mode === "login"
            ? "등록된 계정으로 논문투고·심사 업무를 계속하세요."
            : "한국 디지털 건강체력학회지 온라인 투고·심사 시스템 회원가입을 진행합니다."}
        </p>

        {!isSupabaseConfigured && (
          <div className="notice-box error">Supabase 공개 환경변수가 설정되지 않았습니다.</div>
        )}

        {mode === "signup" ? <>
          <SignupProgress step={signupStep} />
          {signupStep === 1 && <section className="signup-step-panel">
            <div className="signup-step-heading"><small>STEP 01</small><h3>회원선택</h3><p>가입할 회원 유형을 선택해 주세요.</p></div>
            <button className={`member-type-card ${memberType === "individual" ? "selected" : ""}`} type="button" onClick={() => setMemberType("individual")}>
              <span>개인회원</span><strong>논문 투고자 · 연구자</strong><p>논문을 투고하고 심사 진행상태와 결과를 확인합니다.</p><i>{memberType === "individual" ? "선택됨 ✓" : "선택"}</i>
            </button>
            <div className="signup-role-note"><strong>심사위원·편집위원 안내</strong><p>개인회원으로 가입한 뒤 편집관리자가 역할을 부여합니다. 관리자 계정은 회원가입으로 생성할 수 없습니다.</p></div>
            <div className="signup-navigation"><button type="button" onClick={() => setMode("login")}>취소</button><button className="button button-primary" type="button" disabled={!memberType} onClick={() => setSignupStep(2)}>다음단계</button></div>
          </section>}
          {signupStep === 2 && <section className="signup-step-panel">
            <div className="signup-step-heading"><small>STEP 02</small><h3>약관동의</h3><p>필수 약관을 확인하고 동의해 주세요.</p></div>
            <label className="agreement-all"><input type="checkbox" checked={Object.values(agreements).every(Boolean)} onChange={(event) => setAgreements({ service: event.target.checked, privacy: event.target.checked, age: event.target.checked })} /><span>전체 약관에 동의합니다.</span></label>
            <AgreementBox title="서비스 이용약관 (필수)" checked={agreements.service} onChange={(checked) => setAgreements((current) => ({ ...current, service: checked }))}>
              한국 디지털 건강체력학회지 온라인 시스템은 논문 투고, 심사, 편집 및 발행 업무를 제공합니다. 회원은 정확한 정보를 등록하고 타인의 계정을 사용하지 않으며, 연구윤리와 이중맹검 원칙을 준수해야 합니다. 시스템에서 생성된 학술 기록은 학술지 운영과 분쟁 대응을 위해 보존될 수 있습니다.
            </AgreementBox>
            <AgreementBox title="개인정보 수집 및 이용 (필수)" checked={agreements.privacy} onChange={(checked) => setAgreements((current) => ({ ...current, privacy: checked }))}>
              회원 식별과 투고·심사 업무를 위해 이름, 이메일, 소속을 필수로 수집하며 연락처와 연구분야는 선택으로 수집합니다. 개인정보는 회원관리, 업무 알림, 논문 처리에 사용하며 관련 법령과 학술 기록 보존정책에 따라 안전하게 관리합니다. 동의를 거부할 수 있으나 회원가입과 온라인 투고 서비스 이용이 제한됩니다.
            </AgreementBox>
            <label className="agreement-age"><input type="checkbox" checked={agreements.age} onChange={(event) => setAgreements((current) => ({ ...current, age: event.target.checked }))} /><span><strong>만 14세 이상입니다. (필수)</strong><small>본 시스템은 만 14세 미만의 회원가입을 받지 않습니다.</small></span></label>
            <div className="signup-navigation"><button type="button" onClick={() => setSignupStep(1)}>이전단계</button><button className="button button-primary" type="button" disabled={!Object.values(agreements).every(Boolean)} onClick={() => setSignupStep(3)}>다음단계</button></div>
          </section>}
          {signupStep === 3 && <form className="signup-information-form" onSubmit={handleSubmit}>
            <div className="signup-step-heading"><small>STEP 03</small><h3>회원정보입력</h3><p><b>*</b> 표시 항목은 필수입니다.</p></div>
            <div className="signup-form-grid">
              <label><span>성명 <b>*</b></span><input name="fullName" autoComplete="name" required minLength={2} /></label>
              <label><span>소속기관 <b>*</b></span><input name="affiliation" autoComplete="organization" required /></label>
              <label className="wide"><span>이메일(로그인 아이디) <b>*</b></span><input name="email" type="email" autoComplete="email" required /><small>인증 메일을 받을 수 있는 주소를 입력하세요.</small></label>
              <label><span>비밀번호 <b>*</b></span><input name="password" type="password" autoComplete="new-password" required minLength={8} /><small>영문, 숫자 등을 조합하여 8자 이상 입력하세요.</small></label>
              <label><span>비밀번호 확인 <b>*</b></span><input name="passwordConfirm" type="password" autoComplete="new-password" required minLength={8} /></label>
              <label><span>연락처</span><input name="phone" type="tel" autoComplete="tel" placeholder="010-0000-0000" /></label>
              <label><span>연구분야</span><input name="researchFields" placeholder="건강체력, 디지털헬스" /><small>여러 분야는 쉼표로 구분하세요.</small></label>
            </div>
            {message && <p className="form-message" role="alert">{message}</p>}
            <div className="signup-navigation"><button type="button" onClick={() => { setSignupStep(2); setMessage(""); }}>이전단계</button><button className="button button-primary" disabled={busy || !isSupabaseConfigured}>{busy ? "가입 신청 중…" : "가입 신청"}</button></div>
          </form>}
          {signupStep === 4 && <section className="signup-complete">
            <span>✓</span><small>STEP 04</small><h3>가입 신청이 완료되었습니다.</h3><p><strong>{registeredEmail}</strong>로 발송된 인증 메일을 확인해 주세요.<br />이메일 인증과 편집관리자의 승인이 완료되면 로그인할 수 있습니다.</p>
            <div><button className="button button-primary" type="button" onClick={onClose}>확인</button><button type="button" onClick={() => { setMode("login"); setSignupStep(1); setMessage(""); }}>로그인 화면으로</button></div>
          </section>}
        </> : <form className="stack-form" onSubmit={handleSubmit}>
          {adminLogin ? (
            <label>관리자 아이디<input name="username" type="text" autoComplete="username" autoCapitalize="none" pattern="[a-z][a-z0-9._-]{2,31}" minLength={3} maxLength={32} placeholder="admin" required /></label>
          ) : (
            <label>이메일<input name="email" type="email" autoComplete="email" required /></label>
          )}
          <label>비밀번호<input name="password" type="password" autoComplete="current-password" required minLength={8} /></label>
          <button className="button button-primary form-submit" disabled={busy || !isSupabaseConfigured}>{busy ? "처리 중…" : "로그인"}</button>
        </form>}
        {mode === "login" && message && <p className="form-message" role="status">{message}</p>}
        {!adminLogin && mode === "login" && <button className="mode-switch" type="button" onClick={() => { setMode("signup"); setSignupStep(1); setMessage(""); }}>
          {mode === "login" ? "처음 방문하셨나요? 저자 회원가입" : "이미 계정이 있나요? 로그인"}
        </button>}
      </section>
    </div>
  );
}

function SignupProgress({ step }: { step: 1 | 2 | 3 | 4 }) {
  const labels = ["회원선택", "약관동의", "회원정보입력", "가입완료"];
  return <ol className="signup-progress" aria-label="회원가입 단계">{labels.map((label, index) => {
    const number = index + 1;
    return <li className={step === number ? "active" : step > number ? "complete" : ""} key={label}><span>{step > number ? "✓" : number}</span><strong>{label}</strong></li>;
  })}</ol>;
}

function AgreementBox({ title, checked, onChange, children }: { title: string; checked: boolean; onChange: (checked: boolean) => void; children: string }) {
  return <article className="agreement-box"><h4>{title}</h4><div tabIndex={0}>{children}</div><label><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>위 내용을 확인했으며 동의합니다.</span></label></article>;
}
