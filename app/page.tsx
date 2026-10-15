import { Editor } from "@/components/Editor";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-24">
      <div className="w-full max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Kinetix Workspace</h1>
          <p className="text-sm text-zinc-400 mt-1">Local-first collaborative Markdown & Whiteboard environment</p>
        </header>
        <Editor />
      </div>
    </main>
  );
}
