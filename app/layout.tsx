import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "건강체력연구소 | Health & Fitness Lab",
    description:
      "건강체력을 과학적으로 측정하고 해석해, 오래 지속할 수 있는 움직임을 연구합니다.",
    openGraph: {
      title: "건강체력연구소",
      description: "몸의 데이터를 일상의 변화로 연결합니다.",
      locale: "ko_KR",
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og.png`, width: 1729, height: 910, alt: "건강체력연구소" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "건강체력연구소",
      description: "몸의 데이터를 일상의 변화로 연결합니다.",
      images: [`${origin}/og.png`],
    },
  };
}

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
