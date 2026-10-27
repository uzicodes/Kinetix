'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useRoom } from '@liveblocks/react';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';
import { WELCOME_MARKDOWN } from '@/lib/welcome';

interface WorkspaceContextType {
  doc: Y.Doc | null;
  isSynced: boolean;
  isSimulatedOffline: boolean;
  toggleSimulatedOffline: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  doc: null,
  isSynced: false,
  isSimulatedOffline: false,
  toggleSimulatedOffline: () => {},
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
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const yProviderRef = useRef<LiveblocksYjsProvider | null>(null);

  useEffect(() => {
    const yDoc = new Y.Doc();
    setDoc(yDoc);

    // Unique IndexedDB store per document ID
    const idbProvider = new IndexeddbPersistence(`kinetix-db-${documentId}`, yDoc);
    const yProvider = new LiveblocksYjsProvider(room, yDoc);
    yProviderRef.current = yProvider;

    idbProvider.on('synced', () => {
      console.log(`Loaded document ${documentId} from IndexedDB`);
      if (documentId === 'welcome-doc') {
        const yText = yDoc.getText(`kinetix-text-${documentId}`);
        if (yText.length === 0) {
          yDoc.transact(() => {
            yText.insert(0, WELCOME_MARKDOWN);
          });
        }
      }
    });

    yProvider.on('sync', (synced: boolean) => {
      setIsSynced(synced);
    });

    return () => {
      idbProvider.destroy();
      yProvider.destroy();
      yDoc.destroy();
      yProviderRef.current = null;
    };
  }, [room, documentId]);

  const toggleSimulatedOffline = () => {
    if (!yProviderRef.current) return;
    if (isSimulatedOffline) {
      yProviderRef.current.connect();
      setIsSimulatedOffline(false);
    } else {
      yProviderRef.current.disconnect();
      setIsSimulatedOffline(true);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        doc,
        isSynced,
        isSimulatedOffline,
        toggleSimulatedOffline,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
