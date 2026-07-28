import type { Metadata } from "next";
import "./globals.css";

const siteUrl = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "한국 디지털 건강체력학회지 | 온라인 논문투고·심사",
  description: "한국 디지털 건강체력학회지의 논문투고, 이중맹검 심사, 편집판정과 발행을 위한 온라인 시스템입니다.",
  openGraph: { title: "한국 디지털 건강체력학회지", description: "연구가 학술 기록이 되는 안전한 투고·심사 시스템", locale: "ko_KR", type: "website", images: [{ url: new URL("og.png", siteUrl), width: 1536, height: 1024, alt: "한국 디지털 건강체력학회지" }] },
  twitter: { card: "summary_large_image", title: "한국 디지털 건강체력학회지", description: "온라인 논문투고·이중맹검 심사 시스템", images: [new URL("og.png", siteUrl)] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
