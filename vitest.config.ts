import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    define: {
        __APP_BUILD__: JSON.stringify({ number: '57', time: '2026-09-28 14:03 UTC' }),
    },
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
        // Grading a deal runs the solver dozens of times, and the coverage run slows it further.
        testTimeout: 30_000,
        include: ['tests/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['tests/e2e/**/*.spec.ts'],
        benchmark: {
            include: ['tests/bench/**/*.bench.ts'],
            retainSamples: true,
            suppressExportGetterWarnings: true,
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
            include: ['src/**/*.{ts,tsx}'],
            exclude: ['src/main.tsx', 'src/pwa/registerPwa.ts', 'src/vite-env.d.ts'],
        },
    },
});
