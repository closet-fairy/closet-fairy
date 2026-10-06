import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import pluginRouter from '@tanstack/eslint-plugin-router';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import testingLibrary from 'eslint-plugin-testing-library';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const AXIOS_ALLOWED_FILES = ['src/apis/httpClient.ts', 'src/apis/apiError.ts'];
const HEADLESS_ALLOWED_FILES = ['src/components/common/**'];

const AXIOS_RESTRICTION = {
  name: 'axios',
  message: 'axios 요청은 src/apis/httpClient.ts의 공용 인스턴스로만 보내세요.',
};

const HEADLESS_RESTRICTION = {
  group: ['@radix-ui/*', 'radix-ui', 'vaul', 'sonner'],
  message:
    '헤드리스 라이브러리는 src/components/common/에서 감싼 컴포넌트를 통해서만 사용하세요.',
};

export default defineConfig([
  globalIgnores([
    'dist',
    'src/routeTree.gen.ts',
    'public/mockServiceWorker.js',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      pluginQuery.configs['flat/recommended'],
      pluginRouter.configs['flat/recommended'],
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message:
            'enum 대신 문자열 리터럴 유니언이나 as const 객체를 사용하세요.',
        },
        {
          selector: "ImportSpecifier[importKind='type']",
          message: '타입은 import type을 별도 문으로 가져오세요.',
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: [...AXIOS_ALLOWED_FILES, ...HEADLESS_ALLOWED_FILES],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [AXIOS_RESTRICTION], patterns: [HEADLESS_RESTRICTION] },
      ],
    },
  },
  {
    files: AXIOS_ALLOWED_FILES,
    rules: {
      'no-restricted-imports': ['error', { patterns: [HEADLESS_RESTRICTION] }],
    },
  },
  {
    files: HEADLESS_ALLOWED_FILES,
    rules: {
      'no-restricted-imports': ['error', { paths: [AXIOS_RESTRICTION] }],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    extends: [testingLibrary.configs['flat/react']],
  },
  eslintConfigPrettier,
]);
