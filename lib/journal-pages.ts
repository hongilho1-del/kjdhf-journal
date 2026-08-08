import type { BoardPost } from "@/lib/journal";

export const JOURNAL_PAGE_STORAGE_PREFIX = "KJDHF_PAGE:";

const submissionGuidelines = {
  id: "submission-guidelines",
  label: "투고규정·원고작성요령",
  eyebrow: "SUBMISSION & MANUSCRIPT GUIDELINES",
  description: "투고 자격, 제출 절차와 원고 작성 형식에 관한 규정을 안내하는 페이지입니다.",
} as const;

const reviewGuidelines = {
  id: "review-guidelines",
  label: "심사규정",
  eyebrow: "PEER REVIEW GUIDELINES",
  description: "심사위원 선정, 심사 절차와 판정 기준에 관한 규정을 안내하는 페이지입니다.",
} as const;

const researchEthics = {
  id: "research-ethics",
  label: "연구·출판윤리",
  eyebrow: "RESEARCH & PUBLICATION ETHICS",
  description: "연구의 진실성과 출판과정의 공정성을 위한 연구·출판윤리 규정을 안내하는 페이지입니다.",
} as const;

const editorialBoard = {
  id: "editorial-board",
  label: "편집위원회",
  eyebrow: "EDITORIAL BOARD",
  description: "편집위원회 구성과 운영 내용을 안내하는 페이지입니다.",
} as const;

const proofreadingSupport = {
  id: "proofreading-support",
  label: "교정·검수 지원",
  eyebrow: "PROOFREADING & EDITING SUPPORT",
  description: "논문 교정·검수 지원 정보와 외부 서비스 이용 유의사항을 안내하는 페이지입니다.",
} as const;

const manuscriptTemplate = {
  id: "manuscript-template",
  label: "논문 양식 다운로드",
  eyebrow: "MANUSCRIPT TEMPLATE FILES",
  description: "한국디지털건강체력연구 투고용 HWPX 논문 양식을 등록하고 관리합니다.",
} as const;

export const journalInformationNavigation = [
  submissionGuidelines,
  reviewGuidelines,
  researchEthics,
  editorialBoard,
  proofreadingSupport,
] as const;

export const journalPageManagementNavigation = [
  submissionGuidelines,
  manuscriptTemplate,
  reviewGuidelines,
  researchEthics,
  editorialBoard,
  proofreadingSupport,
] as const;

export type JournalInformationPage = (typeof journalPageManagementNavigation)[number]["id"];

export function isJournalInformationPage(value: string): value is JournalInformationPage {
  return journalPageManagementNavigation.some((item) => item.id === value);
}

export function getJournalPageDefinition(page: JournalInformationPage) {
  return journalPageManagementNavigation.find((item) => item.id === page) ?? journalInformationNavigation[0];
}

export function getJournalPageStorageTitle(page: JournalInformationPage) {
  return `${JOURNAL_PAGE_STORAGE_PREFIX}${page}`;
}

export function isJournalPagePost(post: Pick<BoardPost, "title">) {
  return post.title.startsWith(JOURNAL_PAGE_STORAGE_PREFIX);
}
