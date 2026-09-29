import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolveBuildInfo } from './scripts/build-info.mjs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
    version: string;
};

export default defineConfig({
    base: '/solitaire/',
    define: {
        __APP_BUILD__: JSON.stringify(resolveBuildInfo(process.env, new Date())),
        __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    plugins: [
        react(),
        VitePWA({
            registerType: 'prompt',
            injectRegister: false,
            manifest: false,
            workbox: {
                globPatterns: ['**/*.{js,css,html,woff2,ttf,png,svg,webmanifest}'],
                navigateFallback: 'index.html',
                cleanupOutdatedCaches: true,
            },
            devOptions: { enabled: false },
        }),
    ],
    worker: { format: 'es' },
});
