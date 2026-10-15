'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useRoom } from '@liveblocks/react';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';

interface WorkspaceContextType {
  doc: Y.Doc | null;
  isSynced: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  doc: null,
  isSynced: false,
});

export function WorkspaceProvider({ 
  children, 
  documentId 
}: { 
  children: React.ReactNode; 
  documentId: string 
}) {
  const room = useRoom();
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [isSynced, setIsSynced] = useState<boolean>(false);

  useEffect(() => {
    const yDoc = new Y.Doc();
    setDoc(yDoc);

    // Unique IndexedDB store per document ID
    const idbProvider = new IndexeddbPersistence(`kinetix-db-${documentId}`, yDoc);
    const yProvider = new LiveblocksYjsProvider(room, yDoc);

    idbProvider.on('synced', () => {
      console.log(`Loaded document ${documentId} from IndexedDB`);
    });

    yProvider.on('sync', (synced: boolean) => {
      setIsSynced(synced);
    });

    return () => {
      idbProvider.destroy();
      yProvider.destroy();
      yDoc.destroy();
    };
  }, [room, documentId]);

  return (
    <WorkspaceContext.Provider value={{ doc, isSynced }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
