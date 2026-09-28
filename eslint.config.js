import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'dist',
            'tests/fixtures/dist',
            'coverage',
            'playwright-report',
            'test-results',
            'node_modules',
            '.claude/worktrees',
        ],
    },
    eslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/consistent-type-imports': 'error',
        },
    },
    {
        files: ['src/domain/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '^(?!\\./[A-Za-z]+(\\.js)?$)',
                            message: 'src/domain may import only its own sibling modules (./name).',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['src/solver/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '^(?!\\./[A-Za-z]+(\\.js)?$|\\.\\./domain/[A-Za-z]+(\\.js)?$)',
                            message: 'src/solver may import only its own sibling modules (./name) and ../domain/name.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: [
            'src/ui/board/metrics.ts',
            'src/ui/board/layout.ts',
            'src/ui/board/names.ts',
            'src/ui/board/locate.ts',
            'src/ui/board/landing.ts',
            'src/ui/board/pointerController.ts',
            'src/ui/board/keyboardController.ts',
            'src/ui/board/cascadeFrames.ts',
        ],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '^(?!\\./[A-Za-z]+(\\.js)?$|\\.\\./\\.\\./domain/[A-Za-z]+(\\.js)?$|\\.\\./\\.\\./i18n/translate$)',
                            message:
                                'The pure board modules may import only their own siblings (./name), ../../domain/name and, type-only, ../../i18n/translate.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['src/i18n/**/*.{ts,tsx}'],
        ignores: ['src/i18n/useTranslate.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '^(?!\\./[A-Za-z]+(\\.js)?$|\\./locales/[A-Za-z]+(\\.js)?$|\\.\\./[A-Za-z]+(\\.js)?$)',
                            message:
                                'src/i18n may import only its own sibling modules (./name, ./locales/name or, from locales/, ../name).',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['src/features/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': 'off',
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '(^|/)solver(/|$)',
                            allowTypeImports: true,
                            message:
                                'src/features must not value-import solver code: the solver runs in a Web Worker. Use a type-only import or the worker URL.',
                        },
                    ],
                },
            ],
        },
    },
    {
        files: ['src/ui/**/*.{ts,tsx}'],
        rules: {
            '@typescript-eslint/no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '(^|/)app/appSlice$',
                            importNames: ['setRoute', 'sheetOpened', 'sheetClosed'],
                            message:
                                'The UI never changes the route or a sheet directly: dispatch an intent from src/features/game/navigationThunks.ts instead.',
                        },
                    ],
                },
            ],
        },
    },
    prettier,
);
