"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthorDashboard } from "@/components/author-dashboard";
import { AuthorReviewResultPage } from "@/components/author-review-result-page";
import { AuthPanel } from "@/components/auth-panel";
import { CommunityBoard } from "@/components/community-board";
import { EJournalPage } from "@/components/e-journal-page";
import { EditorDashboard } from "@/components/editor-dashboard";
import { HealthFitnessInstitute } from "@/components/health-fitness-institute";
import { JournalInformation } from "@/components/journal-information";
import { ManuscriptSubmissionPage } from "@/components/manuscript-submission-page";
import { ProfilePanel } from "@/components/profile-panel";
import { PublicHome } from "@/components/public-home";
import { ReviewerDashboard } from "@/components/reviewer-dashboard";
import { ROLE_LABELS, type AppRole, type BoardCategory, type Profile } from "@/lib/journal";
import { isJournalInformationPage, type JournalInformationPage } from "@/lib/journal-pages";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type View = "home" | "institute" | "notice" | "events" | "e-journal" | "submission" | "author-review-result" | "dashboard" | "profile" | JournalInformationPage;
const assetBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const INSTITUTE_URL = "https://prhome.kongju.ac.kr/sites/hpflab";
const ROLE_ORDER: AppRole[] = ["AUTHOR", "REVIEWER", "EDITOR", "ADMIN"];

function publicViewFromHash(): View {
  if (typeof window === "undefined") return "home";
  if (window.location.hash.startsWith("#notice")) return "notice";
  if (window.location.hash.startsWith("#events")) return "events";
  if (window.location.hash.startsWith("#e-journal")) return "e-journal";
  if (window.location.hash.startsWith("#online-submission")) return "submission";
  if (window.location.hash.startsWith("#author-review-result")) return "author-review-result";
  if (window.location.hash.startsWith("#health-fitness-institute")) return "institute";
  const hashPage = window.location.hash.slice(1).split("?")[0];
  if (isJournalInformationPage(hashPage)) return hashPage;
  return "home";
}

function hasStandalonePublicHash() {
  return publicViewFromHash() !== "home";
}

export function JournalApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeRole, setActiveRole] = useState<AppRole | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [adminLogin, setAdminLogin] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [view, setView] = useState<View>(publicViewFromHash);
  const [boardPostId, setBoardPostId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async (userId: string) => {
    const supabase = getSupabaseClient();
    const [{ data, error: profileError }, roleResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("profile_roles").select("role").eq("profile_id", userId),
    ]);
    if (profileError) setError(profileError.message);
    else if (!data) setError("사용자 프로필을 준비 중입니다. 잠시 후 새로고침해 주세요.");
    else {
      const assignedRoles = roleResult.error ? [data.role] : (roleResult.data ?? []).map((item) => item.role);
      const isAdministrator = data.role === "ADMIN" || assignedRoles.includes("ADMIN");
      const nextRoles = isAdministrator
        ? ROLE_ORDER
        : ROLE_ORDER.filter((role) => role === "AUTHOR" || assignedRoles.includes(role));
      setProfile(data);
      setRoles(nextRoles);
      setActiveRole((current) => current && nextRoles.includes(current) ? current : data.role);
      setError("");
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseClient();
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        await loadProfile(data.session.user.id);
        if (!hasStandalonePublicHash()) setView("dashboard");
      }
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        window.setTimeout(() => void loadProfile(nextSession.user.id), 0);
        if (!hasStandalonePublicHash()) setView("dashboard");
      } else {
        setProfile(null);
        setRoles([]);
        setActiveRole(null);
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
      } else if (nextView === "institute" || nextView === "e-journal" || nextView === "submission" || nextView === "author-review-result" || isJournalInformationPage(nextView)) {
        setView(nextView);
        setBoardPostId(null);
      } else if (!session || window.location.hash.startsWith("#journal-")) {
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
    if (session) openMyPage();
    else openAuth();
  }

  function openMyPage() {
    setView("dashboard");
    setBoardPostId(null);
    window.history.pushState(null, "", "#my-page");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openSubmission() {
    setView("submission");
    setBoardPostId(null);
    window.history.pushState(null, "", "#online-submission");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (!session) openAuth();
  }

  function openEJournal(tab: "search" | "journal" = "search") {
    setView("e-journal");
    setBoardPostId(null);
    window.history.pushState(null, "", `#e-journal?tab=${tab}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openAuth(asAdmin = false, mode: "login" | "signup" = "login") {
    setAdminLogin(asAdmin);
    setAuthMode(mode);
    setAuthOpen(true);
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

  function openInformation(page: JournalInformationPage) {
    setView(page);
    setBoardPostId(null);
    window.history.pushState(null, "", `#${page}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const dashboardRole = profile && activeRole && roles.includes(activeRole) ? activeRole : profile?.role ?? "AUTHOR";
  const activeProfile = profile ? { ...profile, role: dashboardRole } : null;

  return (
    <main>
      <div className="jams-utility">
        <div className="shell jams-utility-inner">
          <p>한국디지털건강체력연구</p>
          <nav aria-label="사용자 메뉴">
            <a href="https://www.kongju.ac.kr/" target="_blank" rel="noreferrer">국립공주대학교</a>
            <a href={INSTITUTE_URL} target="_blank" rel="noreferrer">건강체력연구소</a>
            <button type="button" onClick={() => openHomeSection("journal-about")}>학술지 안내</button>
            {!session && <button type="button" onClick={() => openAuth()}>로그인</button>}
            {!session && <button type="button" onClick={() => openAuth(false, "signup")}>회원가입</button>}
            {!session && <button className="admin-login-link" type="button" onClick={() => openAuth(true)}>관리자 로그인</button>}
            {session && profile && <span className="utility-user">{profile.full_name || profile.email}님</span>}
            {session && <button className="my-page-link" type="button" onClick={openMyPage}>MY PAGE</button>}
            {session && <button type="button" onClick={() => setView("profile")}>회원정보 수정</button>}
            {session && <button type="button" onClick={() => void signOut()}>로그아웃</button>}
          </nav>
        </div>
      </div>
      <header className="jams-site-header">
        <div className="shell jams-masthead">
          <button className="brand brand-button jams-brand" type="button" onClick={openHome} aria-label="한국디지털건강체력연구 홈">
            {/* eslint-disable-next-line @next/next/no-img-element -- static public asset must work on GitHub Pages basePath */}
            <img className="journal-brand-logo" src={`${assetBasePath}/logos/kjdhp-journal-logo.png`} alt="한국디지털건강체력연구" width={2832} height={1216} />
          </button>
          <div className="jams-header-tools">
            <a className="institute-header-mark" href={INSTITUTE_URL} target="_blank" rel="noreferrer">
              <span>국립공주대학교 건강체력연구소</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- static public asset must work on GitHub Pages basePath */}
              <img src={`${assetBasePath}/logos/health-fitness-institute-logo.png`} alt="건강체력연구소" width={780} height={510} />
            </a>
            {session && profile && (
              <button className="profile-button" type="button" onClick={() => setView("profile")}>
                <span>{profile.full_name?.slice(0, 1) || "나"}</span><b>{profile.full_name || profile.email}</b><small>{roles.map((role) => ROLE_LABELS[role]).join(" · ")}</small>
              </button>
            )}
          </div>
        </div>
        <div className="jams-nav-row">
          <div className="shell jams-nav-inner">
            <nav className="jams-primary-nav" aria-label="주요 메뉴">
              <button type="button" onClick={() => openHomeSection("journal-about")}>학술지 안내</button>
              <button type="button" onClick={() => openEJournal("search")}>e-Journal</button>
              <button type="button" onClick={openSubmission}>논문투고</button>
              <button type="button" onClick={() => openInformation("submission-guidelines")}>투고·심사 안내</button>
              <button type="button" onClick={() => openBoard("NOTICE")}>공지사항</button>
              <button type="button" onClick={() => openBoard("EVENT")}>학술대회</button>
              {session && <button className="my-page-nav-link" type="button" onClick={openMyPage}>MY PAGE</button>}
            </nav>
            <details className="jams-mobile-menu">
              <summary aria-label="전체 메뉴"><span /><span /><span /></summary>
              <nav>
                <button type="button" onClick={() => openHomeSection("journal-about")}>학술지 안내</button>
                <button type="button" onClick={() => openEJournal("search")}>e-Journal</button>
                <button type="button" onClick={openSubmission}>논문투고</button>
                <button type="button" onClick={() => openInformation("submission-guidelines")}>투고·심사 안내</button>
                <button type="button" onClick={() => openBoard("NOTICE")}>공지사항</button>
                <button type="button" onClick={() => openBoard("EVENT")}>학술대회</button>
                {session && <button type="button" onClick={openMyPage}>MY PAGE</button>}
                {!session && <button type="button" onClick={enterSystem}>온라인 투고·심사</button>}
              </nav>
            </details>
            <button className="jams-system-button" type="button" onClick={enterSystem}>{session ? "MY PAGE" : "온라인 투고·심사"} <span>→</span></button>
          </div>
        </div>
      </header>

      {view === "home" ? <PublicHome onEnter={enterSystem} onSubmit={openSubmission} onOpenEJournal={openEJournal} onOpenBoard={openBoard} onOpenInformation={openInformation} /> : view === "institute" ? <HealthFitnessInstitute onBackHome={openHome} /> : view === "e-journal" ? <EJournalPage key={new URLSearchParams(typeof window === "undefined" ? "" : window.location.hash.split("?")[1] ?? "").get("tab") === "journal" ? "journal" : "search"} initialTab={new URLSearchParams(typeof window === "undefined" ? "" : window.location.hash.split("?")[1] ?? "").get("tab") === "journal" ? "journal" : "search"} onBackHome={openHome} /> : view === "notice" || view === "events" ? <CommunityBoard category={view === "notice" ? "NOTICE" : "EVENT"} initialPostId={boardPostId} onCategoryChange={openBoard} onBackHome={openHome} /> : isJournalInformationPage(view) ? <JournalInformation page={view} onNavigate={openInformation} onBackHome={openHome} /> : !session || !profile || !activeProfile ? <section className="access-state"><h1>로그인이 필요합니다.</h1><p>{error || "투고·심사 업무는 인증된 사용자만 이용할 수 있습니다."}</p><button className="button button-primary" onClick={() => openAuth()}>로그인</button></section> : !profile.is_active ? <section className="access-state"><h1>가입 승인 대기 중입니다.</h1><p>이메일 인증과 편집관리자의 승인이 완료되면 시스템을 이용할 수 있습니다.</p><button className="button button-secondary" type="button" onClick={() => void signOut()}>로그아웃</button></section> : view === "submission" ? <section className="workspace submission-workspace"><div className="shell"><ManuscriptSubmissionPage profile={{ ...profile, role: "AUTHOR" }} adminTestMode={roles.includes("ADMIN")} onMyPage={openMyPage} /></div></section> : view === "author-review-result" ? <AuthorReviewResultPage manuscriptId={new URLSearchParams(typeof window === "undefined" ? "" : window.location.hash.split("?")[1] ?? "").get("manuscript")} onMyPage={openMyPage} /> : <section className="workspace"><div className="shell my-page-heading"><div><small>PERSONAL JOURNAL SERVICE</small><h1>My Page</h1></div><p><strong>{profile.full_name || profile.email}</strong>님의 역할별 업무공간입니다.</p></div><div className="shell workspace-shell">
        <div className="role-workspace-switcher" aria-label="내 역할별 페이지">{roles.map((role) => <button className={view === "dashboard" && dashboardRole === role ? "active" : ""} type="button" key={role} onClick={() => { setActiveRole(role); setView("dashboard"); }}><span>{ROLE_LABELS[role]}</span><strong>{role === "AUTHOR" ? "투고자 페이지" : role === "REVIEWER" ? "심사위원 페이지" : role === "EDITOR" ? "편집위원 페이지" : "관리자 페이지"}</strong></button>)}</div>
        <div className="workspace-top"><div><span>{ROLE_LABELS[dashboardRole]}</span><strong>{profile.email}</strong></div><nav><button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>대시보드</button><button className={view === "profile" ? "active" : ""} onClick={() => setView("profile")}>내 정보</button></nav></div>
        {view === "profile" ? <ProfilePanel profile={activeProfile} roles={roles} onSaved={() => loadProfile(profile.id)} /> : dashboardRole === "AUTHOR" ? <AuthorDashboard profile={activeProfile} /> : dashboardRole === "REVIEWER" ? <ReviewerDashboard profile={activeProfile} /> : <EditorDashboard profile={activeProfile} />}
      </div></section>}

      <footer className="jams-footer">
        <div className="shell jams-footer-grid">
          <button className="brand footer-brand brand-button" type="button" onClick={openHome} aria-label="한국디지털건강체력연구 홈">
            {/* eslint-disable-next-line @next/next/no-img-element -- static public asset must work on GitHub Pages basePath */}
            <img className="footer-journal-logo" src={`${assetBasePath}/logos/kjdhp-journal-logo.png`} alt="한국디지털건강체력연구" width={2832} height={1216} loading="lazy" />
          </button>
          <div className="jams-footer-info">
            <p>국립공주대학교 건강체력연구소 · 한국디지털건강체력연구 편집국</p>
            <p>논문 투고 및 심사 문의는 편집관리자에게 문의해 주세요.</p>
            <small>© 2026 KOREAN JOURNAL OF DIGITAL HEALTH &amp; PHYSICAL FITNESS RESEARCH. ALL RIGHTS RESERVED.</small>
          </div>
          <button className="jams-top-button" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>TOP ↑</button>
        </div>
      </footer>
      {authOpen && <AuthPanel adminLogin={adminLogin} initialMode={authMode} onClose={() => setAuthOpen(false)} />}
    </main>
  );
}
