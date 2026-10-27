import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kinetix | Local-First Collaborative Workspace",
  description:
    "Blazing-fast offline-capable collaborative workspace combining real-time Markdown notes with an infinite whiteboard canvas, powered by Yjs CRDTs and Liveblocks.",
  applicationName: "Kinetix",
  keywords: [
    "Kinetix",
    "CRDT",
    "Local-First",
    "Collaborative Workspace",
    "Markdown Editor",
    "Collaborative Whiteboard",
    "Yjs",
    "Liveblocks",
    "IndexedDB",
    "Real-Time Multiplayer",
  ],
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://kinetix-workspace.vercel.app"
  ),
  openGraph: {
    title: "Kinetix | Local-First Collaborative Workspace",
    description:
      "Real-time multiplayer Markdown notes and infinite collaborative canvas whiteboard with offline CRDT sync and instant conflict-free merging.",
    url: "/",
    siteName: "Kinetix",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kinetix — Local-First Collaborative Workspace",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kinetix | Local-First Collaborative Workspace",
    description:
      "Real-time multiplayer Markdown notes and infinite collaborative canvas whiteboard with offline CRDT sync and instant conflict-free merging.",
    images: ["/og-image.png"],
    creator: "@kinetix",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-zinc-950 text-zinc-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
