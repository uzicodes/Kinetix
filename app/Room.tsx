'use client';

import { ReactNode } from 'react';
import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from '@liveblocks/react/suspense';

export function Room({ children }: { children: ReactNode }) {
  return (
    <LiveblocksProvider publicApiKey={process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY!}>
      <RoomProvider id="kinetix-default-room" initialPresence={{}}>
        <ClientSideSuspense fallback={
          <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400 text-sm animate-pulse">
            Connecting to Kinetix multiplayer network...
          </div>
        }>
          {() => children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}

