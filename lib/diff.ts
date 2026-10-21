import * as Y from 'yjs';

/**
 * Calculates the minimal character-level delta between oldText and newText
 * and applies precise insertion/deletion operations to the Y.Text instance.
 *
 * This prevents full-string wipes that corrupt other collaborators' edits.
 */
export function applyTextDelta(yText: Y.Text, oldText: string, newText: string): void {
  if (oldText === newText) return;

  const oldLength = oldText.length;
  const newLength = newText.length;

  // 1. Find common prefix length
  let start = 0;
  while (start < oldLength && start < newLength && oldText[start] === newText[start]) {
    start++;
  }

  // 2. Find common suffix length (ensuring no overlap with prefix)
  let endOld = oldLength;
  let endNew = newLength;
  while (
    endOld > start &&
    endNew > start &&
    oldText[endOld - 1] === newText[endNew - 1]
  ) {
    endOld--;
    endNew--;
  }

  const deleteCount = endOld - start;
  const insertText = newText.slice(start, endNew);

  if (deleteCount > 0) {
    yText.delete(start, deleteCount);
  }
  if (insertText.length > 0) {
    yText.insert(start, insertText);
  }
}

