'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Room } from '@/app/Room';
import { WorkspaceProvider } from '@/app/providers/WorkspaceProvider';
import { Editor } from '@/components/Editor';
import { Sidebar } from '@/components/Sidebar';

function DocumentWorkspace() {
  const params = useParams();
  const documentId = (params?.id as string) || 'welcome-doc';

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar currentDocId={documentId} />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Room roomId={`kinetix-room-${documentId}`}>
          <WorkspaceProvider documentId={documentId}>
            <Editor documentId={documentId} />
          </WorkspaceProvider>
        </Room>
      </main>
    </div>
  );
}

export default function DocumentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400 text-sm animate-pulse">
          Loading Kinetix workspace...
        </div>
      }
    >
      <DocumentWorkspace />
    </Suspense>
  );
}
