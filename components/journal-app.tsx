"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthorDashboard } from "@/components/author-dashboard";
import { AuthPanel } from "@/components/auth-panel";
import { EditorDashboard } from "@/components/editor-dashboard";
import { ProfilePanel } from "@/components/profile-panel";
import { PublicHome } from "@/components/public-home";
import { ReviewerDashboard } from "@/components/reviewer-dashboard";
import { ROLE_LABELS, type Profile } from "@/lib/journal";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type View = "home" | "dashboard" | "profile";

export function JournalApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [view, setView] = useState<View>("home");
  const [error, setError] = useState("");

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error: profileError } = await getSupabaseClient().from("profiles").select("*").eq("id", userId).maybeSingle();
    if (profileError) setError(profileError.message);
    else if (!data) setError("사용자 프로필을 준비 중입니다. 잠시 후 새로고침해 주세요.");
    else { setProfile(data); setError(""); }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseClient();
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        await loadProfile(data.session.user.id);
        setView("dashboard");
      }
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        window.setTimeout(() => void loadProfile(nextSession.user.id), 0);
        setView("dashboard");
      } else {
        setProfile(null);
        setView("home");
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, [loadProfile]);

  async function signOut() {
    await getSupabaseClient().auth.signOut();
    setView("home");
  }

  function enterSystem() {
    if (session) setView("dashboard");
    else setAuthOpen(true);
  }

  function openHomeSection(sectionId: string) {
    setView("home");
    window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  return (
    <main>
      <div className="top-line"><div className="shell top-line-inner"><p>Integrity · Evidence · Digital Health</p><span>한국 디지털 건강체력학회지 온라인 투고·심사 시스템</span></div></div>
      <header className="site-header"><div className="shell nav-wrap journal-nav">
        <button className="brand brand-button" type="button" onClick={() => setView("home")} aria-label="한국 디지털 건강체력학회지 홈">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span className="brand-copy"><strong>한국 디지털 건강체력학회지</strong><small>KOREAN JOURNAL OF DIGITAL HEALTH &amp; FITNESS</small></span>
        </button>
        <nav className="desktop-nav" aria-label="주요 메뉴">
          <button type="button" onClick={() => setView("home")}>학회지 소개</button>
          <button type="button" onClick={() => openHomeSection("journal-policy")}>심사정책</button>
          <button type="button" onClick={() => openHomeSection("journal-workflow")}>투고절차</button>
          {session && <button type="button" onClick={() => setView("dashboard")}>업무현황</button>}
        </nav>
        <div className="nav-account">
          {session && profile ? <><button className="profile-button" type="button" onClick={() => setView("profile")}><span>{profile.full_name?.slice(0, 1) || "나"}</span><b>{profile.full_name || profile.email}</b><small>{ROLE_LABELS[profile.role]}</small></button><button className="nav-logout" type="button" onClick={() => void signOut()}>로그아웃</button></> : <button className="nav-cta" type="button" onClick={() => setAuthOpen(true)}>로그인·회원가입 <span>↗</span></button>}
        </div>
      </div></header>

      {view === "home" ? <PublicHome onEnter={enterSystem} /> : !session || !profile ? <section className="access-state"><h1>로그인이 필요합니다.</h1><p>{error || "투고·심사 업무는 인증된 사용자만 이용할 수 있습니다."}</p><button className="button button-primary" onClick={() => setAuthOpen(true)}>로그인</button></section> : !profile.is_active ? <section className="access-state"><h1>비활성화된 계정입니다.</h1><p>편집관리자에게 계정 상태를 문의해 주세요.</p></section> : <section className="workspace"><div className="shell workspace-shell">
        <div className="workspace-top"><div><span>{ROLE_LABELS[profile.role]}</span><strong>{profile.email}</strong></div><nav><button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>대시보드</button><button className={view === "profile" ? "active" : ""} onClick={() => setView("profile")}>내 정보</button></nav></div>
        {view === "profile" ? <ProfilePanel profile={profile} onSaved={() => loadProfile(profile.id)} /> : profile.role === "AUTHOR" ? <AuthorDashboard profile={profile} /> : profile.role === "REVIEWER" ? <ReviewerDashboard profile={profile} /> : <EditorDashboard profile={profile} />}
      </div></section>}

      <footer><div className="shell footer-grid"><button className="brand footer-brand brand-button" type="button" onClick={() => setView("home")}><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><span className="brand-copy"><strong>한국 디지털 건강체력학회지</strong><small>KJDHF ONLINE JOURNAL</small></span></button><p>연구윤리와 이중맹검 원칙을 지키는 온라인 논문투고·심사 시스템입니다.</p><div className="footer-meta"><span>© 2026 KOREAN JOURNAL OF DIGITAL HEALTH &amp; FITNESS</span><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>BACK TO TOP ↑</button></div></div></footer>
      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} />}
    </main>
  );
}
