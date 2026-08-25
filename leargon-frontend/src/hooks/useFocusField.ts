import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Reads the `field` query parameter a to-do "Fix" link carries, scrolls the matching row into view
 * and reports it as focused so the row can highlight itself briefly.
 *
 * Rows opt in by rendering `id="field-<name>"` (see `PropRow`). The highlight clears itself after a
 * few seconds so a bookmarked URL does not stay permanently marked up.
 */
export function useFocusField(ready: boolean = true): string | null {
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('field');
  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    if (!requested || !ready) {
      setFocused(null);
      return;
    }
    setFocused(requested);
    // The panel may still be rendering when the URL changes, so look for the row on the next frame.
    const scrollTimer = window.setTimeout(() => {
      // Locale fields arrive as "descriptions.en" but render as one row, so fall back to the base name.
      const row =
        document.getElementById(`field-${requested}`) ??
        document.getElementById(`field-${requested.split('.')[0]}`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    const clearTimer = window.setTimeout(() => setFocused(null), 4000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [requested, ready]);

  return focused;
}

/** Whether the focused field name refers to this row, matching "descriptions.en" to "descriptions". */
export function fieldMatches(focused: string | null, fieldName: string): boolean {
  if (!focused) return false;
  return focused === fieldName || focused.startsWith(`${fieldName}.`);
}

export default useFocusField;
