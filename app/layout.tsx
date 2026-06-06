import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChadGPT — ถามชัชชาติ",
  description: "ถามเกี่ยวกับนโยบายและผลงานของชัชชาติ สิทธิพันธุ์ ผู้สมัครผู้ว่าฯ กทม.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
