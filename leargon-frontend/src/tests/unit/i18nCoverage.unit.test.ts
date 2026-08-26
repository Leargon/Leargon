import { describe, expect, it } from 'vitest';
import en from '../../i18n/en';
import de from '../../i18n/de';
import fr from '../../i18n/fr';

/**
 * The localisation guard rail, paired with the `i18next/no-literal-string` ESLint rule.
 *
 * The lint rule stops new English text being hardcoded into a component; this test stops a key being
 * added to one locale and forgotten in the others, which fails silently at runtime — i18next just
 * falls back to English, so a German user sees an English string and nobody notices.
 */

type Tree = Record<string, unknown>;

/** Every leaf path in a translation tree, e.g. `process.parentProcess`. */
function leafKeys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === 'object'
      ? leafKeys(value as Tree, path)
      : [path];
  });
}

function valueAt(tree: Tree, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);
}

const locales: Array<[string, Tree]> = [
  ['de', de as unknown as Tree],
  ['fr', fr as unknown as Tree],
];

describe('i18n resource files', () => {
  const englishKeys = leafKeys(en as unknown as Tree);

  it('define at least one key', () => {
    expect(englishKeys.length).toBeGreaterThan(0);
  });

  it.each(locales)('%s defines every key English defines', (_name, tree) => {
    const missing = englishKeys.filter((key) => valueAt(tree, key) === undefined);
    expect(missing).toEqual([]);
  });

  it.each(locales)('%s defines no key English does not', (_name, tree) => {
    const english = new Set(englishKeys);
    const extra = leafKeys(tree).filter((key) => !english.has(key));
    expect(extra).toEqual([]);
  });

  it.each(locales)('%s has no blank translations', (_name, tree) => {
    const blank = leafKeys(tree).filter((key) => {
      const value = valueAt(tree, key);
      return typeof value === 'string' && value.trim() === '';
    });
    expect(blank).toEqual([]);
  });

  it.each(locales)('%s keeps every interpolation placeholder English uses', (_name, tree) => {
    // A dropped `{{count}}` renders the literal braces to the user rather than a number.
    const placeholders = (text: string) => (text.match(/\{\{\s*\w+\s*\}\}/g) ?? []).sort();
    const mismatched = englishKeys.filter((key) => {
      const source = valueAt(en as unknown as Tree, key);
      const target = valueAt(tree, key);
      if (typeof source !== 'string' || typeof target !== 'string') return false;
      return placeholders(source).join() !== placeholders(target).join();
    });
    expect(mismatched).toEqual([]);
  });
});
