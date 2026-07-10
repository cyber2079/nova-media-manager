import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // ══ Catch declaration-order bugs (TDZ, undefined refs) ══
      // variables warn only — 存量 12 条待逐步清理
      '@typescript-eslint/no-use-before-define': ['warn', {
        functions: false,
        classes: true,
        variables: true,
        allowNamedExports: false,
      }],
    },
  },
])
