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

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const room = useRoom();
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [isSynced, setIsSynced] = useState<boolean>(false);

  useEffect(() => {
    // 1. Initialize core Yjs Document
    const yDoc = new Y.Doc();
    setDoc(yDoc);

    // 2. Set up local-first IndexedDB persistence
    const idbProvider = new IndexeddbPersistence('kinetix-workspace-db', yDoc);

    // 3. Set up Liveblocks WebSocket Yjs provider for real-time multiplayer sync
    const yProvider = new LiveblocksYjsProvider(room, yDoc);

    idbProvider.on('synced', () => {
      console.log('Loaded from local IndexedDB');
    });

    yProvider.on('sync', (isSynced: boolean) => {
      setIsSynced(isSynced);
    });

    return () => {
      idbProvider.destroy();
      yProvider.destroy();
      yDoc.destroy();
    };
  }, [room]);

  return (
    <WorkspaceContext.Provider value={{ doc, isSynced }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
