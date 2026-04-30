import type { Metadata } from "next";
import "./globals.css";
import { MainNav } from "@/components/layout/main-nav";

export const metadata: Metadata = {
  title: "AI简历助手",
  description: "AI驱动的简历制作与面试准备工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full font-sans text-foreground">
        <MainNav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
