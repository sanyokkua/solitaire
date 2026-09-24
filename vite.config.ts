import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    base: '/solitaire/',
    define: {
        __APP_BUILD_TIMESTAMP__: JSON.stringify(process.env.BUILD_TIMESTAMP ?? 'dev version'),
    },
    plugins: [react()],
    worker: { format: 'es' },
});
