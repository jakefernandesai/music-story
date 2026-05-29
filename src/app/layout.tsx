import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { SpotifyConnectButton } from "@/components/SpotifyConnectButton";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Music Story — Discover the narrative behind any track",
  description:
    "Paste a Spotify track URL and explore a visual music story enriched with MusicBrainz data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <div className="mx-auto flex min-h-full max-w-lg flex-col px-5 pb-12 pt-8 sm:max-w-xl">
          <header className="mb-10 flex items-start justify-between gap-4">
            <Link
              href="/"
              className="inline-block font-display text-xl font-medium tracking-tight text-foreground transition-opacity hover:opacity-80"
            >
              Music Story
            </Link>
            <Suspense fallback={<span className="text-xs text-muted">…</span>}>
              <SpotifyConnectButton />
            </Suspense>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
