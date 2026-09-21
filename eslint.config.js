import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
    plugins: { react },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Core no-unused-vars does not read JSX, so an import used only as an
      // element — `motion` in <motion.div>, an imported Icon — reads as dead
      // and every such file failed lint. This rule marks JSX references as
      // uses. Only this rule from the plugin: the recommended set brings a
      // large set of separate opinions that are not what was broken here.
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
    },
  },
  {
    // Server-side code: the serverless proxy and the build/verification
    // scripts run under Node, not in a browser. Without this they lint as if
    // `process` were undefined, which buries real findings under noise.
    files: ['api/**/*.js', 'scripts/**/*.js', 'tests/**/*.js', '*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
