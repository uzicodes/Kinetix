'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

interface WorkspaceContextType {
  doc: Y.Doc | null;
  provider: IndexeddbPersistence | null;
  isSynced: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  doc: null,
  provider: null,
  isSynced: false,
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<IndexeddbPersistence | null>(null);
  const [isSynced, setIsSynced] = useState<boolean>(false);

  useEffect(() => {
    // 1. Initialize the core Yjs Document
    const yDoc = new Y.Doc();
    setDoc(yDoc);

    // 2. Initialize IndexedDB persistence for local-first storage
    const idbProvider = new IndexeddbPersistence('kinetix-workspace-db', yDoc);
    setProvider(idbProvider);

    idbProvider.on('synced', () => {
      console.log('Content successfully loaded from IndexedDB');
      setIsSynced(true);
    });

    return () => {
      idbProvider.destroy();
      yDoc.destroy();
    };
  }, []);

  return (
    <WorkspaceContext.Provider value={{ doc, provider, isSynced }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);

