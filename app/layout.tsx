import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scheme",
  description:
    "A planning aid for USC students. Sample results on this skeleton use invented DEMO data. STARS remains the official audit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
