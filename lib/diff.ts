import * as Y from 'yjs';
import diff from 'fast-diff';

/**
 * Calculates character-level deltas between oldText and newText using `fast-diff`
 * and dispatches precise insertion and deletion operations to the Y.Text instance.
 *
 * This prevents full-string wipes that corrupt other collaborators' edits.
 */
export function applyTextDelta(yText: Y.Text, oldText: string, newText: string): void {
  if (oldText === newText) return;

  const diffs = diff(oldText, newText);
  let index = 0;

  for (const [type, text] of diffs) {
    if (type === diff.EQUAL) {
      index += text.length;
    } else if (type === diff.DELETE) {
      yText.delete(index, text.length);
    } else if (type === diff.INSERT) {
      yText.insert(index, text);
      index += text.length;
    }
  }
}
