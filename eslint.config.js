import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * Invariant I2 is enforced below: @md/core may import nothing but
 * @codemirror/* and @lezer/*. No Node, no Electron, no framework, no Tailwind.
 */
const CORE_FORBIDDEN = [
  {
    group: ['node:*', 'fs', 'fs/*', 'path', 'os', 'child_process', 'crypto', 'util', 'stream', 'events', 'url', 'process'],
    message:
      'I2: @md/core is framework- and platform-agnostic. Node built-ins belong in apps/desktop.'
  },
  {
    group: ['electron', 'electron/*', 'electron-*'],
    message: 'I2: @md/core must not know about Electron. Move this to apps/desktop.'
  },
  {
    group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'vue', 'svelte', 'solid-js', '@md/react'],
    message: 'I2: @md/core is framework-agnostic. Framework code belongs in packages/react.'
  },
  {
    group: ['tailwindcss', 'tailwindcss/*', 'clsx', 'tailwind-merge', '@base-ui-components/*'],
    message: 'I2/I5: no Tailwind and no UI-kit dependencies in @md/core.'
  },
  {
    group: ['turndown', 'chokidar', 'lodash', 'lodash/*'],
    message: 'I2: @md/core depends on @codemirror/* and @lezer/* only.'
  }
]

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-types/**',
      '**/out/**',
      '**/node_modules/**',
      '**/*.tsbuildinfo',
      'apps/desktop/release/**'
    ]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          // Destructuring a prop out so the rest object no longer carries it
          // is the idiom, not a mistake.
          ignoreRestSiblings: true
        }
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }]
    }
  },

  // ---- I2 boundary -------------------------------------------------------
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: CORE_FORBIDDEN }]
    }
  },

  // Node-side code
  {
    files: [
      'apps/desktop/src/main/**/*.ts',
      'apps/desktop/src/preload/**/*.ts',
      '**/*.config.ts',
      '**/*.config.js',
      'eslint.config.js'
    ],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' }
  },

  // Tests
  {
    files: ['**/test/**/*.ts', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: { globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' }
  }
)
