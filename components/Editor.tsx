'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWorkspace } from '@/app/providers/WorkspaceProvider';
import { saveDocumentMeta } from '@/lib/storage';
import * as Y from 'yjs';

export function Editor({ documentId }: { documentId: string }) {
  const { doc, isSynced } = useWorkspace();
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>('Untitled Document');
  const isRemoteChange = useRef<boolean>(false);
  const sharedTextRef = useRef<Y.Text | null>(null);

  useEffect(() => {
    if (!doc) return;

    const yText = doc.getText(`kinetix-text-${documentId}`);
    sharedTextRef.current = yText;
    setContent(yText.toString());

    // Extract title from the first line of text if available
    const firstLine = yText.toString().split('\n')[0];
    if (firstLine.trim()) {
      setTitle(firstLine.slice(0, 30));
    }

    const observer = () => {
      isRemoteChange.current = true;
      const textVal = yText.toString();
      setContent(textVal);
      const line = textVal.split('\n')[0];
      const newTitle = line.trim() ? line.slice(0, 30) : 'Untitled Document';
      setTitle(newTitle);
      saveDocumentMeta(documentId, newTitle);
    };

    yText.observe(observer);

    return () => {
      yText.unobserve(observer);
    };
  }, [doc, documentId]);

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

        const line = newText.split('\n')[0];
        const newTitle = line.trim() ? line.slice(0, 30) : 'Untitled Document';
        setTitle(newTitle);
        saveDocumentMeta(documentId, newTitle);
      });
    }
  };

  if (!isSynced) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 text-sm animate-pulse">
        Syncing workspace...
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100 truncate max-w-md">
          {title}
        </h1>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/50">
            ● Synced & Live
          </span>
        </div>
      </div>
      
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Type your notes here... (First line becomes the document title)"
        className="w-full h-[70vh] p-5 bg-zinc-900 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-700 font-mono text-sm leading-relaxed resize-none shadow-sm text-zinc-200 placeholder:text-zinc-600"
      />
    </div>
  );
}
