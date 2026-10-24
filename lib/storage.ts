export interface DocMeta {
  id: string;
  title: string;
  updatedAt: number;
}

const STORAGE_KEY = 'kinetix_documents_index';

// Get all documents from local storage
export function getDocuments(): DocMeta[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    // Default initial document if none exist
    const defaultDocs: DocMeta[] = [
      { id: 'welcome-doc', title: 'Getting Started with Kinetix', updatedAt: Date.now() }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultDocs));
    return defaultDocs;
  }
  return JSON.parse(data);
}

export function getDocumentMeta(id: string): DocMeta | undefined {
  if (typeof window === 'undefined') return undefined;
  return getDocuments().find((d) => d.id === id);
}

// Save or update a document in the index
export function saveDocumentMeta(id: string, title: string) {
  if (typeof window === 'undefined') return;
  const docs = getDocuments();
  const existingIndex = docs.findIndex((d) => d.id === id);

  if (existingIndex >= 0) {
    docs[existingIndex].title = title;
    docs[existingIndex].updatedAt = Date.now();
  } else {
    docs.unshift({ id, title, updatedAt: Date.now() });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  window.dispatchEvent(new CustomEvent('kinetix:documents-updated', { detail: { id, title } }));
}

// Delete a document from the index
export function deleteDocumentMeta(id: string): DocMeta[] {
  if (typeof window === 'undefined') return [];
  const docs = getDocuments().filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  window.dispatchEvent(new CustomEvent('kinetix:documents-updated', { detail: { id } }));
  return docs;
}

