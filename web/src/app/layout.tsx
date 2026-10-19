import type { Metadata, Viewport } from "next";
import { Noto_Sans_Bengali } from "next/font/google";
import { Suspense } from "react";
import { AppFooter, AppHeader, AppHeaderFallback } from "@/components/app-header";
import "./globals.css";

// Bengali subset only, no metric fallback: Latin text falls through to Segoe UI / system-ui,
// matching the design's font stack.
const bengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  adjustFontFallback: false,
  fallback: [],
});

export const metadata: Metadata = {
  title: "CivicTrust",
  description: "Citizens report road and garbage problems; AI ranks them and verifies every repair before the job closes.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6750A4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn" className={`${bengali.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {/* Apply the saved theme before paint so there's no light flash. An explicit ct_theme cookie
            wins; otherwise the CSS prefers-color-scheme media query follows the OS. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var m=document.cookie.match(/(?:^|; )ct_theme=(light|dark)/);if(m)document.documentElement.setAttribute('data-theme',m[1]);}catch(e){}})();",
          }}
        />
        <div className="ambient-bg" aria-hidden>
          <div className="ambient-blob blob-1" />
          <div className="ambient-blob blob-2" />
          <div className="ambient-blob blob-3" />
        </div>
        <Suspense fallback={<AppHeaderFallback />}>
          <AppHeader />
        </Suspense>
        <main className="container flex-1" style={{ paddingTop: 32 }}>
          {children}
        </main>
        <Suspense>
          <AppFooter />
        </Suspense>
      </body>
    </html>
  );
}
