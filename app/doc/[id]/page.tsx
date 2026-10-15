'use client';

import { useParams } from 'next/navigation';
import { Room } from '@/app/Room';
import { WorkspaceProvider } from '@/app/providers/WorkspaceProvider';
import { Editor } from '@/components/Editor';
import { Sidebar } from '@/components/Sidebar';

export default function DocumentPage() {
  const params = useParams();
  const documentId = (params?.id as string) || 'welcome-doc';

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar />
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

