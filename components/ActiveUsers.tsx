'use client';

import React, { useEffect } from 'react';
import { useOthers, useSelf, useUpdateMyPresence } from '@liveblocks/react';
import { getOrCreateUserSession } from '@/lib/user';

export function ActiveUsers() {
  const others = useOthers();
  const self = useSelf();
  const updateMyPresence = useUpdateMyPresence();

  // Initialize or synchronize local presence
  useEffect(() => {
    const session = getOrCreateUserSession();
    updateMyPresence({
      name: session.name,
      color: session.color,
    });
  }, [updateMyPresence]);

  const hasSelf = !!self;
  const totalCount = (hasSelf ? 1 : 0) + others.length;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center -space-x-2">
        {/* Current user avatar */}
        {hasSelf && (
          <div
            className="relative group inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold text-white ring-2 ring-zinc-950 transition-transform hover:scale-110 hover:z-20 cursor-default shadow-sm"
            style={{ backgroundColor: (self.presence as any)?.color || '#10B981' }}
          >
            {((self.presence as any)?.name || 'You').slice(0, 2).toUpperCase()}
            {/* Tooltip */}
            <div className="absolute top-full mt-2 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
              <div className="bg-zinc-800 text-zinc-100 text-[11px] font-medium py-1 px-2 rounded-md shadow-lg border border-zinc-700 whitespace-nowrap">
                {(self.presence as any)?.name || 'Anonymous'} (You)
              </div>
            </div>
          </div>
        )}

        {/* Other connected peers */}
        {others.slice(0, 3).map((peer) => {
          const peerName = (peer.presence as any)?.name || `Peer #${peer.connectionId}`;
          const peerColor = (peer.presence as any)?.color || '#3B82F6';
          const initials = peerName.slice(0, 2).toUpperCase();

          return (
            <div
              key={peer.connectionId}
              className="relative group inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold text-white ring-2 ring-zinc-950 transition-transform hover:scale-110 hover:z-20 cursor-default shadow-sm"
              style={{ backgroundColor: peerColor }}
            >
              {initials}
              {/* Tooltip */}
              <div className="absolute top-full mt-2 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                <div className="bg-zinc-800 text-zinc-100 text-[11px] font-medium py-1 px-2 rounded-md shadow-lg border border-zinc-700 whitespace-nowrap">
                  {peerName}
                </div>
              </div>
            </div>
          );
        })}

        {/* Overflow indicator if > 4 users */}
        {others.length > 3 && (
          <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 text-zinc-300 ring-2 ring-zinc-950 text-[10px] font-medium">
            +{others.length - 3}
          </div>
        )}
      </div>

      <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline">
        {totalCount === 1 ? '1 active' : `${totalCount} active`}
      </span>
    </div>
  );
}

