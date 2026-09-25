import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules', '.claude/worktrees'] },
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
        files: ['src/ui/board/metrics.ts', 'src/ui/board/layout.ts'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            regex: '^(?!\\./[A-Za-z]+(\\.js)?$|\\.\\./\\.\\./domain/[A-Za-z]+(\\.js)?$)',
                            message:
                                'The pure board modules may import only their own siblings (./name) and ../../domain/name.',
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
    prettier,
);
