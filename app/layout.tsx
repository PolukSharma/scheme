import type { Metadata } from "next";
import Link from "next/link";
import { Source_Sans_3 } from "next/font/google";
import { SchemeWord } from "@/components/scheme-word";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Scheme",
  description:
    "A planning aid for USC students. STARS remains the official audit. Scheme supports an advisor and does not replace one.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={sourceSans.className}>
        <a className="skip no-print" href="#content">
          Skip to content
        </a>
        <p className="banner no-print" role="note">
          STARS remains the official audit. <SchemeWord /> supports an advisor and does not replace one. Nothing is saved in this browser.
        </p>
        {children}
        <footer className="colophon wrap no-print">
          <p>
            <Link href="/accuracy">Accuracy</Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
