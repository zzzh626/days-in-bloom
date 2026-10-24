import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "我的每一天 · 花开日记",
  description: "写下每日心情与日常，在日历里留下生活的痕迹。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
