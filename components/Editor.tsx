'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useWorkspace } from '@/app/providers/WorkspaceProvider';
import { saveDocumentMeta } from '@/lib/storage';
import { applyTextDelta } from '@/lib/diff';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { Avatars } from '@/components/Avatars';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { Whiteboard } from '@/components/Whiteboard';
import { FileText, PenTool, Columns, Eye, Download, Wifi, WifiOff } from 'lucide-react';
import * as Y from 'yjs';

// Unique origin identifier for local CRDT transactions to prevent echo loops
const LOCAL_TRANSACTION_ORIGIN = 'kinetix-local-editor';

type ViewMode = 'notes' | 'whiteboard' | 'split';

export function Editor({ documentId }: { documentId: string }) {
  const { doc, isSynced, isSimulatedOffline, toggleSimulatedOffline } = useWorkspace();
  const [content, setContent] = useState<string>('');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [title, setTitle] = useState<string>('Untitled Document');
  const [viewMode, setViewMode] = useState<ViewMode>('notes');
  const [showPreview, setShowPreview] = useState<boolean>(true);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sharedTextRef = useRef<Y.Text | null>(null);
  const prevContentRef = useRef<string>('');
  const titleDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Debounce Markdown preview parsing to decouple heavy AST renders from 60fps typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setPreviewContent(content);
    }, 150);

    return () => clearTimeout(handler);
  }, [content]);

  // 2. Debounced document title & metadata persistence to avoid blocking the main thread
  const updateDocumentTitle = (text: string) => {
    const firstLine = text.split('\n')[0];
    const newTitle = firstLine.trim() ? firstLine.slice(0, 30) : 'Untitled Document';
    setTitle(newTitle);

    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
    }

    titleDebounceRef.current = setTimeout(() => {
      saveDocumentMeta(documentId, newTitle);
    }, 300);
  };

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (titleDebounceRef.current) {
        clearTimeout(titleDebounceRef.current);
      }
    };
  }, []);

  // 3. Yjs CRDT binding with origin filtering to prevent bidirectional state loops & cursor jumps
  useEffect(() => {
    if (!doc) return;

    const yText = doc.getText(`kinetix-text-${documentId}`);
    sharedTextRef.current = yText;
    const initialText = yText.toString();
    setContent(initialText);
    setPreviewContent(initialText);
    prevContentRef.current = initialText;

    const firstLine = initialText.split('\n')[0];
    if (firstLine.trim()) {
      setTitle(firstLine.slice(0, 30));
    }

    const observer = (event: Y.YTextEvent) => {
      // CRITICAL FIX: Skip local transactions!
      // When local typing dispatches a change, the textarea and React content state are
      // already up-to-date. Re-applying them here destroys the browser's native caret position.
      if (event.transaction.origin === LOCAL_TRANSACTION_ORIGIN) {
        return;
      }

      const updatedText = yText.toString();
      prevContentRef.current = updatedText;

      const textarea = textareaRef.current;
      const hasFocus = typeof document !== 'undefined' && document.activeElement === textarea;

      // Adjust selection and cursor position for remote changes if textarea is focused
      if (textarea && hasFocus && event.delta) {
        const currentStart = textarea.selectionStart;
        const currentEnd = textarea.selectionEnd;
        let startOffset = 0;
        let endOffset = 0;
        let index = 0;

        event.delta.forEach((op) => {
          if (op.retain) {
            index += op.retain;
          } else if (op.insert) {
            const len = typeof op.insert === 'string' ? op.insert.length : 1;
            if (index <= currentStart) {
              startOffset += len;
            }
            if (index <= currentEnd) {
              endOffset += len;
            }
            index += len;
          } else if (op.delete) {
            if (index < currentStart) {
              startOffset -= Math.min(op.delete, currentStart - index);
            }
            if (index < currentEnd) {
              endOffset -= Math.min(op.delete, currentEnd - index);
            }
          }
        });

        const nextStart = Math.max(0, currentStart + startOffset);
        const nextEnd = Math.max(0, currentEnd + endOffset);

        setContent(updatedText);

        // Flawlessly restore caret range after remote DOM update
        requestAnimationFrame(() => {
          if (textareaRef.current && document.activeElement === textareaRef.current) {
            textareaRef.current.setSelectionRange(nextStart, nextEnd);
          }
        });
      } else {
        setContent(updatedText);
      }

      // Sync document title from remote changes
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

  // 4. Synchronous, ultra-responsive local input handler
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const oldText = prevContentRef.current;

    // Synchronously update textarea state so typing feels instantaneous (native speed)
    setContent(newText);
    prevContentRef.current = newText;

    // Debounce the metadata save to eliminate synchronous localStorage IO lag
    updateDocumentTitle(newText);

    // Dispatch minimal character-level delta tagged with our local origin
    if (doc && sharedTextRef.current) {
      doc.transact(() => {
        applyTextDelta(sharedTextRef.current!, oldText, newText);
      }, LOCAL_TRANSACTION_ORIGIN);
    }
  };

  const handleExportMarkdown = () => {
    const safeName =
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'document';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const wordCount = useMemo(() => {
    return content.trim() ? content.trim().split(/\s+/).length : 0;
  }, [content]);

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

        <div className="flex flex-wrap items-center gap-3">
          {/* Active Presence Avatars */}
          <Avatars />

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

          {/* Segmented Toggle Button Group: Notes | Whiteboard | Split */}
          <div className="flex items-center p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-400">
            <button
              onClick={() => setViewMode('notes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'notes'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'hover:text-zinc-200'
              }`}
              title="Notes View"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Notes</span>
            </button>
            <button
              onClick={() => setViewMode('whiteboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'whiteboard'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'hover:text-zinc-200'
              }`}
              title="Whiteboard View"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Whiteboard</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'split'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'hover:text-zinc-200'
              }`}
              title="Split View (Notes + Whiteboard)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
          </div>

          {/* Toggleable Markdown Preview Button in 'notes' mode */}
          {viewMode === 'notes' && (
            <button
              onClick={() => setShowPreview((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showPreview
                  ? 'bg-zinc-800 text-emerald-400 border-zinc-700 shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
              title="Toggle Live Markdown Preview"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{showPreview ? 'Hide Preview' : 'Show Preview'}</span>
            </button>
          )}

          {/* Action buttons: Export .md & Simulate Offline Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportMarkdown}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors shadow-sm"
              title="Download document as Markdown (.md)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export .md</span>
            </button>

            <button
              onClick={toggleSimulatedOffline}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border shadow-sm ${
                isSimulatedOffline
                  ? 'bg-amber-950 text-amber-300 border-amber-800/80 hover:bg-amber-900'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
              title={
                isSimulatedOffline
                  ? 'Currently Offline: Click to reconnect WebSocket and merge edits'
                  : 'Simulate network cut to test offline CRDT merging'
              }
            >
              {isSimulatedOffline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-amber-400" />
                  <span>Reconnect Sync</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="hidden sm:inline">Simulate Offline</span>
                </>
              )}
            </button>
          </div>

          {/* Real-time Network Indicator */}
          <ConnectionStatus />
        </div>
      </div>

      {/* Conditional View Rendering: 'notes' | 'whiteboard' | 'split' */}
      <div className="flex-1 flex gap-6 min-h-[70vh]">
        {/* 'notes': Markdown editor + toggleable preview */}
        {viewMode === 'notes' && (
          <div className="flex-1 flex flex-col md:flex-row gap-6 w-full">
            {/* Markdown Editor */}
            <div className={`flex flex-col ${showPreview ? 'w-full md:w-1/2' : 'w-full'}`}>
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

            {/* Toggleable Live Preview with debounced content */}
            {showPreview && (
              <div className="flex flex-col w-full md:w-1/2">
                <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase mb-2 px-1 flex items-center justify-between">
                  <span>Rendered Preview</span>
                  <span className="text-[10px] text-emerald-500 font-mono">Live GFM</span>
                </div>
                <div className="w-full flex-1 p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-y-auto">
                  <MarkdownPreview content={previewContent} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 'whiteboard': Full-screen collaborative whiteboard canvas */}
        {viewMode === 'whiteboard' && (
          <div className="flex-1 flex flex-col w-full h-full min-h-[75vh]">
            <Whiteboard documentId={documentId} />
          </div>
        )}

        {/* 'split': 2-column grid showing Markdown editor on left & whiteboard on right */}
        {viewMode === 'split' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full h-full min-h-[75vh]">
            {/* Left Column: Markdown Editor */}
            <div className="flex flex-col w-full h-[75vh]">
              <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase mb-2 px-1 flex items-center justify-between">
                <span>Document Notes</span>
                <span className="text-[10px] text-zinc-600 font-mono">Y.Text CRDT</span>
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                placeholder="Type your notes here while sketching on the right canvas..."
                className="w-full flex-1 p-5 bg-zinc-900 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-700 font-mono text-sm leading-relaxed resize-none shadow-sm text-zinc-200 placeholder:text-zinc-600"
              />
            </div>

            {/* Right Column: Collaborative Whiteboard */}
            <div className="flex flex-col w-full h-[75vh]">
              <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase mb-2 px-1 flex items-center justify-between">
                <span>Collaborative Canvas</span>
                <span className="text-[10px] text-emerald-500 font-mono">Y.Array CRDT</span>
              </div>
              <div className="flex-1 w-full h-full">
                <Whiteboard documentId={documentId} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
