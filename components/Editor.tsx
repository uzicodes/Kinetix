'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWorkspace } from '@/app/providers/WorkspaceProvider';
import { saveDocumentMeta } from '@/lib/storage';
import { applyTextDelta } from '@/lib/diff';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { ActiveUsers } from '@/components/ActiveUsers';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { Whiteboard } from '@/components/Whiteboard';
import { Columns2, Eye, PenLine, FileText, Palette, Layout, Download, Wifi, WifiOff } from 'lucide-react';
import * as Y from 'yjs';

type ViewMode = 'edit' | 'split' | 'preview';
type WorkspaceMode = 'doc' | 'split' | 'whiteboard';

export function Editor({ documentId }: { documentId: string }) {
  const { doc, isSynced, isSimulatedOffline, toggleSimulatedOffline } = useWorkspace();
  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>('Untitled Document');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('doc');
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

        <div className="flex flex-wrap items-center gap-3">
          {/* Active Multiplayer Presence */}
          <ActiveUsers />

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

          {/* Primary Workspace Mode Switcher */}
          <div className="flex items-center p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-400">
            <button
              onClick={() => setWorkspaceMode('doc')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                workspaceMode === 'doc'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'hover:text-zinc-200'
              }`}
              title="Document Editor Mode"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Document</span>
            </button>
            <button
              onClick={() => setWorkspaceMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                workspaceMode === 'split'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'hover:text-zinc-200'
              }`}
              title="Split Mode (Document & Whiteboard)"
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Split View</span>
            </button>
            <button
              onClick={() => setWorkspaceMode('whiteboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                workspaceMode === 'whiteboard'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'hover:text-zinc-200'
              }`}
              title="Whiteboard Canvas Mode"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Whiteboard</span>
            </button>
          </div>

          {/* Document-specific sub-mode switcher (visible when document is showing) */}
          {workspaceMode === 'doc' && (
            <div className="flex items-center p-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-400">
              <button
                onClick={() => setViewMode('edit')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors ${
                  viewMode === 'edit'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'hover:text-zinc-200'
                }`}
                title="Edit Markdown source"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>Write</span>
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors ${
                  viewMode === 'split'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'hover:text-zinc-200'
                }`}
                title="Split Markdown & Preview"
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Split</span>
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'hover:text-zinc-200'
                }`}
                title="Rendered Markdown Preview"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>
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

          {/* Connection & Persistence Status Badge */}
          <ConnectionStatus />
        </div>
      </div>

      {/* Dynamic Content Pane based on workspaceMode */}
      <div className="flex-1 flex gap-6 min-h-[70vh]">
        {/* Document Editor Mode */}
        {workspaceMode === 'doc' && (
          <div className="flex-1 flex gap-6 w-full">
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
        )}

        {/* Full Whiteboard Mode */}
        {workspaceMode === 'whiteboard' && (
          <div className="flex-1 flex flex-col w-full h-full min-h-[75vh]">
            <Whiteboard documentId={documentId} />
          </div>
        )}

        {/* Split View Mode: Document on Left, Whiteboard on Right */}
        {workspaceMode === 'split' && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 w-full">
            {/* Document Side */}
            <div className="flex flex-col w-full lg:w-1/2 h-[75vh]">
              <div className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase mb-2 px-1 flex items-center justify-between">
                <span>Document Notes</span>
                <span className="text-[10px] text-zinc-600 font-mono">Y.Text CRDT</span>
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                placeholder="Type your notes here while sketching on the right..."
                className="w-full flex-1 p-5 bg-zinc-900 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-700 font-mono text-sm leading-relaxed resize-none shadow-sm text-zinc-200 placeholder:text-zinc-600"
              />
            </div>

            {/* Whiteboard Side */}
            <div className="flex flex-col w-full lg:w-1/2 h-[75vh]">
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
