import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        environmentOptions: {
            jsdom: {
                url: 'http://localhost/solitaire/',
            },
        },
        setupFiles: ['./tests/setup.ts'],
        globals: true,
        css: true,
        passWithNoTests: true,
        include: ['tests/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['tests/e2e/**/*.spec.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
            exclude: ['src/main.tsx', 'src/vite-env.d.ts'],
        },
    },
});
