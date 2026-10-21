'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWorkspace } from '@/app/providers/WorkspaceProvider';
import { saveDocumentMeta } from '@/lib/storage';
import { applyTextDelta } from '@/lib/diff';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { Columns2, Eye, PenLine } from 'lucide-react';
import * as Y from 'yjs';

type ViewMode = 'edit' | 'split' | 'preview';

export function Editor({ documentId }: { documentId: string }) {
  const { doc, isSynced } = useWorkspace();
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>('Untitled Document');
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isRemoteChange = useRef<boolean>(false);
  const sharedTextRef = useRef<Y.Text | null>(null);
  const prevContentRef = useRef<string>('');

  useEffect(() => {
    if (!doc) return;

    const yText = doc.getText(`kinetix-text-${documentId}`);
    sharedTextRef.current = yText;
    const initialText = yText.toString();
    setContent(initialText);
    prevContentRef.current = initialText;

    // Extract title from the first line of text if available
    const firstLine = initialText.split('\n')[0];
    if (firstLine.trim()) {
      setTitle(firstLine.slice(0, 30));
    }

    const observer = (event: Y.YTextEvent) => {
      const updatedText = yText.toString();
      prevContentRef.current = updatedText;

      const textarea = textareaRef.current;
      const hasFocus = typeof document !== 'undefined' && document.activeElement === textarea;

      // Preserve cursor position during concurrent remote edits
      if (textarea && hasFocus && event.delta) {
        const currentPos = textarea.selectionStart;
        let cursorOffset = 0;
        let index = 0;

        event.delta.forEach((op) => {
          if (op.retain) {
            index += op.retain;
          }
          if (op.insert) {
            const len = typeof op.insert === 'string' ? op.insert.length : 1;
            if (index <= currentPos) {
              cursorOffset += len;
            }
            index += len;
          }
          if (op.delete) {
            if (index < currentPos) {
              cursorOffset -= Math.min(op.delete, currentPos - index);
            }
          }
        });

        const nextPos = Math.max(0, currentPos + cursorOffset);
        isRemoteChange.current = true;
        setContent(updatedText);

        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(nextPos, nextPos);
          }
        });
      } else {
        isRemoteChange.current = true;
        setContent(updatedText);
      }

      const line = updatedText.split('\n')[0];
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
    const oldText = prevContentRef.current;
    setContent(newText);
    prevContentRef.current = newText;

    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      return;
    }

    if (doc && sharedTextRef.current) {
      doc.transact(() => {
        const yText = sharedTextRef.current!;
        // Character-level minimal diff to prevent cursor overwriting
        applyTextDelta(yText, oldText, newText);

        const line = newText.split('\n')[0];
        const newTitle = line.trim() ? line.slice(0, 30) : 'Untitled Document';
        setTitle(newTitle);
        saveDocumentMeta(documentId, newTitle);
      });
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  if (!isSynced) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 text-sm animate-pulse">
        Syncing workspace...
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full p-6 md:p-8 max-w-7xl mx-auto">
      {/* Document Header & Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100 truncate max-w-md">
            {title}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {wordCount} words · {charCount} characters
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-400">
            <button
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'edit'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'hover:text-zinc-200'
              }`}
              title="Edit Mode (Code only)"
            >
              <PenLine className="w-3.5 h-3.5" />
              <span>Write</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'split'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'hover:text-zinc-200'
              }`}
              title="Split Mode (Editor + Preview)"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'preview'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'hover:text-zinc-200'
              }`}
              title="Preview Mode (Markdown rendered)"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/50">
            ● Synced & Live
          </span>
        </div>
      </div>

      {/* Editor & Preview Pane */}
      <div className="flex-1 flex gap-6 min-h-[70vh]">
        {/* Write Pane */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`flex flex-col ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase mb-2 px-1 flex items-center justify-between">
              <span>Markdown Source</span>
              <span className="text-[10px] text-zinc-600 font-mono">CRDT Delta Sync</span>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              placeholder="# Welcome to Kinetix&#10;&#10;Start typing markdown notes here...&#10;- Instant peer collaboration&#10;- Character-level delta CRDT&#10;- Live rendered preview"
              className="w-full flex-1 p-5 bg-zinc-900 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-700 font-mono text-sm leading-relaxed resize-none shadow-sm text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
        )}

        {/* Live Preview Pane */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`flex flex-col ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase mb-2 px-1 flex items-center justify-between">
              <span>Rendered Preview</span>
              <span className="text-[10px] text-emerald-500 font-mono">Live GFM</span>
            </div>
            <div className="w-full flex-1 p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-y-auto">
              <MarkdownPreview content={content} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
