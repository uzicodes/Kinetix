import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kinetix — Local-First Collaborative Workspace",
  description: "Blazing-fast offline-capable note-taking and brainstorming workspace",
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
