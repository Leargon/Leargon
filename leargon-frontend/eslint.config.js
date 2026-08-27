import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import i18next from 'eslint-plugin-i18next'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results', 'src/api/generated']),
  {
    files: ['vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // Guard rail for localisation: a user-visible string literal in a component is a bug, because a
    // German user then reads English. Everything displayed goes through t() or comes from the API.
    // Only this one rule runs here — the TS sources are otherwise not type-linted, and turning on the
    // recommended sets in the same pass would bury the localisation findings.
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // react-hooks is registered but not enabled: the TS sources carry `eslint-disable react-hooks/...`
    // comments from before they were linted, and an unregistered rule name in a disable comment is
    // itself an error. Turning the rules on surfaces ~46 pre-existing hook findings that have nothing
    // to do with localisation, so that is left for its own change.
    plugins: { i18next, 'react-hooks': reactHooks },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          // JSX text and the attributes that end up on screen. Plain TS is out of scope: it holds enum
          // values, query keys and field names, which are identifiers rather than prose.
          mode: 'jsx-only',
          'should-validate-template': true,
          message: 'User-visible text must go through t() — see src/i18n/en.ts.',
          'jsx-attributes': {
            include: ['label', 'title', 'placeholder', 'helperText', 'aria-label', 'alt', 'secondary', 'primary'],
          },
          callees: {
            // The defaults plus this app's own predicates, which take field names rather than prose.
            exclude: [
              'i18n(ext)?', 't', 'require', 'addEventListener', 'removeEventListener', 'postMessage',
              'getElementById', 'dispatch', 'commit', 'includes', 'indexOf', 'endsWith', 'startsWith',
              'isHidden', 'isLocaleHidden', 'isClassificationHidden', 'isSectionEnabled', 'isEnabled',
              'canEditField', 'fieldMatches', 'renderStatus', 'navigate', 'getState', 'setEditValue',
              'startEdit', 'localeCompare', 'setItem', 'getItem', 'removeItem', 'querySelector', 'getCountryName', 'replace', 'renderItemStatus',
            ],
          },
          words: {
            exclude: [
              '[0-9!-/:-@[-`{-~]+',
              '[A-Z_-]+',
              '^[^A-Za-z]*$',
              '^#[0-9a-fA-F]{3,8}$', // hex colours
              // MUI severity/colour/size props and local state tokens: identifiers the library reads,
              // never text a user sees.
              '^(idle|loading|success|error|warning|info|default|primary|secondary|inherit|small|medium|large|none)$',
            ],
          },
        },
      ],
    },
  },
  {
    // Test specs assert on literal user-facing text by design.
    files: ['src/tests/**/*.{ts,tsx}'],
    rules: { 'i18next/no-literal-string': 'off' },
  },
])
