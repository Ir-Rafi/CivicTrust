import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader, AppHeaderFallback } from "@/components/app-header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bengali = Noto_Sans_Bengali({ variable: "--font-bengali", subsets: ["bengali"] });

export const metadata: Metadata = {
  title: "CivicTrust",
  description: "Citizens report road and garbage problems; AI ranks them and verifies every repair before the job closes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f6e4f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="bn"
      className={`${geistSans.variable} ${geistMono.variable} ${bengali.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Suspense fallback={<AppHeaderFallback />}>
          <AppHeader />
        </Suspense>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-line">
          <nav className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-4 text-sm text-muted">
            <Link href="/architecture">Architecture</Link>
            <Link href="/data">Data</Link>
            <Link href="/security">Security</Link>
            <Link href="/audit">Audit</Link>
            <span className="ml-auto">Map data © OpenStreetMap contributors (ODbL)</span>
          </nav>
        </footer>
      </body>
    </html>
  );
}
