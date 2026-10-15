'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWorkspace } from '@/app/providers/WorkspaceProvider';
import * as Y from 'yjs';

export function Editor() {
  const { doc, isSynced } = useWorkspace();
  const [content, setContent] = useState<string>('');
  const isRemoteChange = useRef<boolean>(false);
  const sharedTextRef = useRef<Y.Text | null>(null);

  useEffect(() => {
    if (!doc) return;

    const yText = doc.getText('kinetix-doc-text');
    sharedTextRef.current = yText;

    setContent(yText.toString());

    const observer = () => {
      isRemoteChange.current = true;
      setContent(yText.toString());
    };

    yText.observe(observer);

    return () => {
      yText.unobserve(observer);
    };
  }, [doc]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);

    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      return;
    }

    if (doc && sharedTextRef.current) {
      doc.transact(() => {
        const yText = sharedTextRef.current!;
        const length = yText.length;
        yText.delete(0, length);
        yText.insert(0, newText);
      });
    }
  };

  if (!isSynced) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 text-sm animate-pulse">
        Loading local workspace from IndexedDB...
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Untitled Document</h1>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/50">
            ● Local DB Synced
          </span>
        </div>
      </div>
      
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Start writing your thoughts, notes, or code blocks here... (Persists offline)"
        className="w-full h-[60vh] p-4 bg-zinc-900 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-700 font-mono text-sm leading-relaxed resize-none shadow-sm text-zinc-200 placeholder:text-zinc-600"
      />
      <p className="mt-2 text-xs text-zinc-500 text-right">
        Changes are stored locally via IndexedDB. Refresh the page to verify persistence.
      </p>
    </div>
  );
}

