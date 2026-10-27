export const WELCOME_MARKDOWN = `# Welcome to Kinetix ⚡️

**Kinetix** is a high-performance, **local-first collaborative workspace** combining rich Markdown notes with an infinite real-time canvas whiteboard. Built from the ground up on Conflict-free Replicated Data Types (CRDTs), Kinetix works completely offline and converges state conflict-free upon reconnecting.

---

### 🚀 Interactive Recruiter Test Drive

Try these features right now in your browser:

- [x] **Character-Level Delta CRDT**: Type notes freely. Unlike naive collaborative text editors that replace entire strings, Kinetix uses \`fast-diff\` delta operations bound directly to \`Y.Text\` to preserve remote carets and avoid overwriting concurrent edits.
- [ ] **Multi-Tab Multiplayer Test**: Copy this URL (\`/doc/welcome-doc\`) into another tab or an incognito window. Type side-by-side or sketch simultaneously to watch sub-millisecond CRDT synchronization.
- [ ] **Simulate Offline Mode**: Click the **Simulate Offline** button in the top toolbar to disconnect WebSocket transport. Make concurrent edits in both tabs, click **Reconnect Sync**, and watch the CRDT merge edits deterministically without merge conflicts!
- [ ] **Whiteboard & Split View**: Toggle the **Notes | Whiteboard | Split** views in the header. Sketch freehand with pressure-sensitive strokes, test the spatial stroke eraser, or upload and drag images around the board.
- [ ] **Live Markdown Preview**: Toggle the **Preview** button to inspect real-time rendered GitHub Flavored Markdown (GFM) with syntax highlighting, tables, and task lists.
- [ ] **Document Renaming & Export**: Click the document title in the header or the pencil icon in the sidebar to rename this workspace. Click **Export .md** or **PNG** to download your work client-side.

---

### 🛠️ Architecture & Under the Hood

Kinetix is engineered around local-first software principles:

1. **CRDT Core (\`Yjs\`)**: All document notes (\`Y.Text\`), titles, collaborative strokes (\`Y.Array\`), and draggable board images (\`Y.Map\`) are modeled as CRDT data structures with deterministic convergence.
2. **Offline-First Persistence (\`y-indexeddb\`)**: Every keystroke and canvas stroke persists to browser IndexedDB storage before touching the network. Documents survive full offline page reloads.
3. **Real-Time Mesh Transport (\`Liveblocks\` & WebSockets)**: Ultra-low latency state vector synchronization and multiplayer presence awareness (active peer avatars and connection status).
4. **Performance Optimizations**: 
   - Local transaction origin filtering (\`LOCAL_TRANSACTION_ORIGIN\`) to eliminate echo loops and caret displacement.
   - Debounced AST markdown parsing (150ms) and memoization for a guaranteed 60fps typing experience.
   - Spatial line-to-circle hit detection with bounding-box pre-checks for instant stroke erasing.
`;

