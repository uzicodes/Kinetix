'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDocuments, saveDocumentMeta, deleteDocumentMeta, DocMeta } from '@/lib/storage';
import { Plus, FileText, Trash2, Pencil, Zap } from 'lucide-react';

export function Sidebar({ currentDocId }: { currentDocId: string }) {
  const router = useRouter();
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');

  useEffect(() => {
    const updateList = () => setDocs(getDocuments());
    updateList();

    if (typeof window !== 'undefined') {
      window.addEventListener('kinetix:documents-updated', updateList);
      return () => window.removeEventListener('kinetix:documents-updated', updateList);
    }
  }, [currentDocId]);

  const handleCreateNew = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    saveDocumentMeta(newId, 'Untitled Document');
    setDocs(getDocuments());
    router.push(`/doc/${newId}`);
  };

  const handleStartRename = (e: React.MouseEvent, docItem: DocMeta) => {
    e.stopPropagation();
    setEditingDocId(docItem.id);
    setEditTitle(docItem.title || 'Untitled Document');
  };

  const handleConfirmRename = (id: string) => {
    const trimmed = editTitle.trim() || 'Untitled Document';
    saveDocumentMeta(id, trimmed);
    setEditingDocId(null);
    setDocs(getDocuments());
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = deleteDocumentMeta(id);
    setDocs(updated);
    if (currentDocId === id) {
      if (updated.length > 0) {
        router.push(`/doc/${updated[0].id}`);
      } else {
        handleCreateNew();
      }
    }
  };

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-emerald-400">
            <Zap className="w-4 h-4" />
          </div>
          <span className="font-semibold tracking-tight text-zinc-100">Kinetix</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">v0.1</span>
      </div>

      {/* New Document Button */}
      <div className="p-3">
        <button
          onClick={handleCreateNew}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium rounded-lg border border-zinc-800 transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          New Document
        </button>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className="text-[10px] font-semibold tracking-wider text-zinc-500 px-2 pb-1 uppercase">
          Workspaces
        </div>
        {docs.map((doc) => {
          const isActive = currentDocId === doc.id;
          const isEditing = editingDocId === doc.id;

          if (isEditing) {
            return (
              <div
                key={doc.id}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700"
              >
                <FileText className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => handleConfirmRename(doc.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleConfirmRename(doc.id);
                    } else if (e.key === 'Escape') {
                      setEditingDocId(null);
                    }
                  }}
                  className="bg-transparent text-xs text-zinc-100 w-full focus:outline-none placeholder:text-zinc-600"
                  autoFocus
                />
              </div>
            );
          }

          return (
            <div
              key={doc.id}
              onClick={() => router.push(`/doc/${doc.id}`)}
              className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                isActive
                  ? 'bg-zinc-900 text-zinc-100 font-medium border border-zinc-800'
                  : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
                <span className="truncate">{doc.title || 'Untitled Document'}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleStartRename(e, doc)}
                  className="p-1 hover:text-zinc-200 text-zinc-500 transition-colors"
                  title="Rename Document"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {docs.length > 1 && (
                  <button
                    onClick={(e) => handleDelete(e, doc.id)}
                    className="p-1 hover:text-red-400 text-zinc-500 transition-colors"
                    title="Delete Document"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-zinc-800/60 text-[11px] text-zinc-500 flex items-center justify-between">
        <span>Offline CRDT Mode</span>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
      </div>
    </aside>
  );
}