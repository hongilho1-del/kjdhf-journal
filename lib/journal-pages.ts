import type { BoardPost } from "@/lib/journal";

export const JOURNAL_PAGE_STORAGE_PREFIX = "KJDHF_PAGE:";

export const journalInformationNavigation = [
  {
    id: "submission-guidelines",
    label: "논문 투고규정 및 원고작성요령",
    eyebrow: "SUBMISSION & MANUSCRIPT GUIDELINES",
    description: "투고 자격, 제출 절차와 원고 작성 형식에 관한 규정을 안내하는 페이지입니다.",
  },
  {
    id: "review-guidelines",
    label: "심사 규정",
    eyebrow: "PEER REVIEW GUIDELINES",
    description: "심사위원 선정, 심사 절차와 판정 기준에 관한 규정을 안내하는 페이지입니다.",
  },
  {
    id: "research-ethics",
    label: "연구 윤리위원회",
    eyebrow: "RESEARCH ETHICS COMMITTEE",
    description: "연구윤리위원회 구성과 연구윤리 관련 내용을 안내하는 페이지입니다.",
  },
  {
    id: "editorial-board",
    label: "편집위원회",
    eyebrow: "EDITORIAL BOARD",
    description: "편집위원회 구성과 운영 내용을 안내하는 페이지입니다.",
  },
  {
    id: "manuscript-template",
    label: "논문 양식 다운로드",
    eyebrow: "MANUSCRIPT TEMPLATE",
    description: "한국디지털건강체력연구 투고용 논문 양식을 제공하는 페이지입니다.",
  },
] as const;

export type JournalInformationPage = (typeof journalInformationNavigation)[number]["id"];

export function isJournalInformationPage(value: string): value is JournalInformationPage {
  return journalInformationNavigation.some((item) => item.id === value);
}

export function getJournalPageDefinition(page: JournalInformationPage) {
  return journalInformationNavigation.find((item) => item.id === page) ?? journalInformationNavigation[0];
}

export function getJournalPageStorageTitle(page: JournalInformationPage) {
  return `${JOURNAL_PAGE_STORAGE_PREFIX}${page}`;
}

export function isJournalPagePost(post: Pick<BoardPost, "title">) {
  return post.title.startsWith(JOURNAL_PAGE_STORAGE_PREFIX);
}
