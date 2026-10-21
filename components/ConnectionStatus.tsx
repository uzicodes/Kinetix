'use client';

import React, { useEffect, useState } from 'react';
import { useStatus } from '@liveblocks/react';
import { useWorkspace } from '@/app/providers/WorkspaceProvider';
import { WifiOff, RadioTower } from 'lucide-react';

export function ConnectionStatus() {
  const { isSimulatedOffline } = useWorkspace();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const roomStatus = useStatus();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isSimulatedOffline) {
    return (
      <span
        title="Offline Mode is simulated. WebSocket disconnected; changes buffered in local IndexedDB."
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950 text-amber-300 border border-amber-800/80 shadow-sm"
      >
        <RadioTower className="w-3 h-3 text-amber-400 animate-pulse" />
        <span>Offline (Simulated) — Local Buffer</span>
      </span>
    );
  }

  const isDisconnected = !isOnline || roomStatus === 'disconnected';
  const isReconnecting = isOnline && (roomStatus === 'connecting' || roomStatus === 'reconnecting');

  if (isDisconnected) {
    return (
      <span
        title="Changes are safely buffered in local IndexedDB and will sync once reconnected"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-400 border border-amber-800/60 shadow-sm"
      >
        <WifiOff className="w-3 h-3 text-amber-400" />
        <span>Offline — Saved to IndexedDB</span>
      </span>
    );
  }

  if (isReconnecting) {
    return (
      <span
        title="Reconnecting to Liveblocks multiplayer network..."
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-950/80 text-yellow-400 border border-yellow-800/60 shadow-sm animate-pulse"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
        <span>Reconnecting...</span>
      </span>
    );
  }

  return (
    <span
      title="Connected to Liveblocks CRDT room & local IndexedDB"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/50 shadow-sm"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span>Online & Syncing</span>
    </span>
  );
}
