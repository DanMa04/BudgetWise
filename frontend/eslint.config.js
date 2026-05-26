import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
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
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'jsx-a11y/heading-has-content': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/router.tsx', 'src/test/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/components/accounts/AccountLinkFlow.tsx'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/components/budgets/AllocationGrid.tsx'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: [
      'src/components/budgets/CategorySliderRow.tsx',
      'src/components/budgets/GoalAllocationRow.tsx',
      'src/components/budgets/GoalVerticalBar.tsx',
      'src/components/budgets/IncomeHeader.tsx',
      'src/components/charts/CategoryOverTimeChart.tsx',
      'src/components/goals/GoalDetail.tsx',
      'src/components/goals/GoalForm.tsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/components/charts/CategoryOverTimeChart.tsx'],
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
  {
    files: [
      'src/components/charts/CategoryOverTimeChart.tsx',
      'src/components/charts/VendorPieChart.tsx',
      'src/context/SidebarContext.tsx',
      'src/context/ThemeContext.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
