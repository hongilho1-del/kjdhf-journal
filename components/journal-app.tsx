"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthorDashboard } from "@/components/author-dashboard";
import { AuthPanel } from "@/components/auth-panel";
import { CommunityBoard } from "@/components/community-board";
import { EditorDashboard } from "@/components/editor-dashboard";
import { ProfilePanel } from "@/components/profile-panel";
import { PublicHome } from "@/components/public-home";
import { ReviewerDashboard } from "@/components/reviewer-dashboard";
import { ROLE_LABELS, type BoardCategory, type Profile } from "@/lib/journal";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type View = "home" | "notice" | "events" | "dashboard" | "profile";

function publicViewFromHash(): View {
  if (typeof window === "undefined") return "home";
  if (window.location.hash.startsWith("#notice")) return "notice";
  if (window.location.hash.startsWith("#events")) return "events";
  return "home";
}

export function JournalApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [view, setView] = useState<View>(publicViewFromHash);
  const [boardPostId, setBoardPostId] = useState<string | null>(null);
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
        if (!window.location.hash.startsWith("#notice") && !window.location.hash.startsWith("#events")) setView("dashboard");
      }
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        window.setTimeout(() => void loadProfile(nextSession.user.id), 0);
        if (!window.location.hash.startsWith("#notice") && !window.location.hash.startsWith("#events")) setView("dashboard");
      } else {
        setProfile(null);
        setView("home");
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, [loadProfile]);

  useEffect(() => {
    function syncPublicView() {
      const nextView = publicViewFromHash();
      if (nextView === "notice" || nextView === "events") {
        setView(nextView);
        setBoardPostId(new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("post"));
      } else if (!session) {
        setView("home");
        setBoardPostId(null);
      }
    }
    window.addEventListener("hashchange", syncPublicView);
    return () => window.removeEventListener("hashchange", syncPublicView);
  }, [session]);

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
    setBoardPostId(null);
    window.history.pushState(null, "", `#${sectionId}`);
    window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function openBoard(category: BoardCategory, postId?: string) {
    const nextView = category === "NOTICE" ? "notice" : "events";
    setView(nextView);
    setBoardPostId(postId ?? null);
    window.history.pushState(null, "", `#${nextView}${postId ? `?post=${encodeURIComponent(postId)}` : ""}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openHome() {
    setView("home");
    setBoardPostId(null);
    window.history.pushState(null, "", "#journal-home");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main>
      <div className="jams-utility">
        <div className="shell jams-utility-inner">
          <p>한국 디지털 건강체력학회지</p>
          <nav aria-label="사용자 메뉴">
            <a href="https://www.kongju.ac.kr/" target="_blank" rel="noreferrer">국립공주대학교</a>
            <button type="button" onClick={() => openHomeSection("journal-about")}>학회지 안내</button>
            {!session && <button type="button" onClick={() => setAuthOpen(true)}>로그인</button>}
            {!session && <button type="button" onClick={() => setAuthOpen(true)}>회원가입</button>}
            {session && <button type="button" onClick={() => setView("dashboard")}>나의 업무</button>}
            {session && <button type="button" onClick={() => void signOut()}>로그아웃</button>}
          </nav>
        </div>
      </div>
      <header className="jams-site-header">
        <div className="shell jams-masthead">
          <button className="brand brand-button jams-brand" type="button" onClick={openHome} aria-label="한국 디지털 건강체력학회지 홈">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span className="brand-copy"><strong>한국 디지털 건강체력학회지</strong><small>KOREAN JOURNAL OF DIGITAL HEALTH &amp; FITNESS</small></span>
          </button>
          <div className="jams-header-tools">
            <span>국립공주대학교 건강체력연구소</span>
            {session && profile ? (
              <button className="profile-button" type="button" onClick={() => setView("profile")}>
                <span>{profile.full_name?.slice(0, 1) || "나"}</span><b>{profile.full_name || profile.email}</b><small>{ROLE_LABELS[profile.role]}</small>
              </button>
            ) : (
              <button className="jams-login-button" type="button" onClick={() => setAuthOpen(true)}>온라인 투고·심사</button>
            )}
          </div>
        </div>
        <div className="jams-nav-row">
          <div className="shell jams-nav-inner">
            <nav className="jams-primary-nav" aria-label="주요 메뉴">
              <button type="button" onClick={() => openHomeSection("journal-about")}>학회</button>
              <button type="button" onClick={() => openHomeSection("latest-journal")}>학술지</button>
              <button type="button" onClick={() => openHomeSection("journal-workflow")}>논문투고</button>
              <button type="button" onClick={() => openHomeSection("journal-policy")}>심사안내</button>
              <button type="button" onClick={() => openBoard("NOTICE")}>공지사항</button>
              <button type="button" onClick={() => openBoard("EVENT")}>학회행사</button>
              {session && <button type="button" onClick={() => setView("dashboard")}>나의 업무</button>}
            </nav>
            <details className="jams-mobile-menu">
              <summary aria-label="전체 메뉴"><span /><span /><span /></summary>
              <nav>
                <button type="button" onClick={() => openHomeSection("journal-about")}>학회</button>
                <button type="button" onClick={() => openHomeSection("latest-journal")}>학술지</button>
                <button type="button" onClick={() => openHomeSection("journal-workflow")}>논문투고</button>
                <button type="button" onClick={() => openHomeSection("journal-policy")}>심사안내</button>
                <button type="button" onClick={() => openBoard("NOTICE")}>공지사항</button>
                <button type="button" onClick={() => openBoard("EVENT")}>학회행사</button>
                <button type="button" onClick={enterSystem}>온라인 투고·심사</button>
              </nav>
            </details>
            <button className="jams-system-button" type="button" onClick={enterSystem}>온라인 투고·심사 <span>→</span></button>
          </div>
        </div>
      </header>

      {view === "home" ? <PublicHome onEnter={enterSystem} onOpenBoard={openBoard} /> : view === "notice" || view === "events" ? <CommunityBoard category={view === "notice" ? "NOTICE" : "EVENT"} initialPostId={boardPostId} onCategoryChange={openBoard} onBackHome={openHome} /> : !session || !profile ? <section className="access-state"><h1>로그인이 필요합니다.</h1><p>{error || "투고·심사 업무는 인증된 사용자만 이용할 수 있습니다."}</p><button className="button button-primary" onClick={() => setAuthOpen(true)}>로그인</button></section> : !profile.is_active ? <section className="access-state"><h1>가입 승인 대기 중입니다.</h1><p>이메일 인증과 편집관리자의 승인이 완료되면 시스템을 이용할 수 있습니다.</p><button className="button button-secondary" type="button" onClick={() => void signOut()}>로그아웃</button></section> : <section className="workspace"><div className="shell workspace-shell">
        <div className="workspace-top"><div><span>{ROLE_LABELS[profile.role]}</span><strong>{profile.email}</strong></div><nav><button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>대시보드</button><button className={view === "profile" ? "active" : ""} onClick={() => setView("profile")}>내 정보</button></nav></div>
        {view === "profile" ? <ProfilePanel profile={profile} onSaved={() => loadProfile(profile.id)} /> : profile.role === "AUTHOR" ? <AuthorDashboard profile={profile} /> : profile.role === "REVIEWER" ? <ReviewerDashboard profile={profile} /> : <EditorDashboard profile={profile} />}
      </div></section>}

      <footer className="jams-footer">
        <div className="shell jams-footer-grid">
          <button className="brand footer-brand brand-button" type="button" onClick={openHome}>
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span className="brand-copy"><strong>한국 디지털 건강체력학회지</strong><small>KJDHF ONLINE JOURNAL</small></span>
          </button>
          <div className="jams-footer-info">
            <p>국립공주대학교 건강체력연구소 · 한국 디지털 건강체력학회지 편집국</p>
            <p>논문 투고 및 심사 문의는 편집관리자에게 문의해 주세요.</p>
            <small>© 2026 KOREAN JOURNAL OF DIGITAL HEALTH &amp; FITNESS. ALL RIGHTS RESERVED.</small>
          </div>
          <button className="jams-top-button" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>TOP ↑</button>
        </div>
      </footer>
      {authOpen && <AuthPanel onClose={() => setAuthOpen(false)} />}
    </main>
  );
}
