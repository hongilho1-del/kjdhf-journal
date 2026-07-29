"use client";

export const journalInformationNavigation = [
  { id: "submission-guidelines", label: "논문투고 규정" },
  { id: "editorial-board", label: "편집위원회" },
  { id: "research-ethics", label: "연구 윤리위원회" },
  { id: "manuscript-template", label: "논문 양식 다운로드" },
] as const;

export type JournalInformationPage = (typeof journalInformationNavigation)[number]["id"];

const PAGE_COPY: Record<JournalInformationPage, { eyebrow: string; title: string; description: string }> = {
  "submission-guidelines": {
    eyebrow: "SUBMISSION GUIDELINES",
    title: "논문투고 규정",
    description: "투고 자격, 원고 작성, 제출 절차에 관한 규정을 안내하는 페이지입니다.",
  },
  "editorial-board": {
    eyebrow: "EDITORIAL BOARD",
    title: "편집위원회",
    description: "편집위원회 구성과 운영 내용을 안내하는 페이지입니다.",
  },
  "research-ethics": {
    eyebrow: "RESEARCH ETHICS COMMITTEE",
    title: "연구 윤리위원회",
    description: "연구윤리위원회 구성과 연구윤리 관련 내용을 안내하는 페이지입니다.",
  },
  "manuscript-template": {
    eyebrow: "MANUSCRIPT TEMPLATE",
    title: "논문 양식 다운로드",
    description: "한국 디지털 건강체력학회지 투고용 논문 양식을 제공하는 페이지입니다.",
  },
};

export function isJournalInformationPage(value: string): value is JournalInformationPage {
  return journalInformationNavigation.some((item) => item.id === value);
}

export function JournalInformation({
  page,
  onNavigate,
  onBackHome,
}: {
  page: JournalInformationPage;
  onNavigate: (page: JournalInformationPage) => void;
  onBackHome: () => void;
}) {
  const copy = PAGE_COPY[page];

  return (
    <section className="journal-information-page">
      <div className="community-hero">
        <div className="shell">
          <p>ABOUT THE JOURNAL</p>
          <h1>{copy.title}</h1>
          <nav aria-label="현재 위치">
            <button type="button" onClick={onBackHome}>홈</button>
            <span>›</span>
            <strong>{copy.title}</strong>
          </nav>
        </div>
      </div>

      <div className="shell community-layout journal-information-layout">
        <aside className="community-side-nav journal-information-nav">
          <h2>학회지 안내</h2>
          {journalInformationNavigation.map((item) => (
            <button className={page === item.id ? "active" : ""} type="button" onClick={() => onNavigate(item.id)} key={item.id}>
              {item.label} <span>›</span>
            </button>
          ))}
        </aside>

        <div className="journal-information-content">
          <div className="community-heading">
            <div><small>{copy.eyebrow}</small><h2>{copy.title}</h2></div>
          </div>
          <div className="journal-information-placeholder">
            <span>CONTENT PREPARING</span>
            <h3>내용을 준비하고 있습니다.</h3>
            <p>{copy.description}<br />전달해 주시는 최종 내용으로 이 페이지를 업데이트하겠습니다.</p>
            {page === "manuscript-template" && (
              <button type="button" disabled>논문 양식 준비 중</button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
