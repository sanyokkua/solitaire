import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize } from 'node:path';

const BASE = '/solitaire/';
const TYPES: Readonly<Record<string, string>> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
};

export interface DistServer {
    /** The app's URL, `http://127.0.0.1:<port>/solitaire/`. */
    readonly url: string;
    /** From now on `sw.js` carries a new trailing comment, so the browser sees a new worker version. */
    changeWorker(): void;
    close(): Promise<void>;
}

/**
 * Serves the built `dist/` under `/solitaire/` on its own port and can switch `sw.js` to changed bytes on demand.
 * Playwright's `context.route` never sees a service worker's update check, so the update spec owns its origin instead.
 */
export async function startDistServer(distDir = 'dist'): Promise<DistServer> {
    let version = 0;
    const server: Server = createServer((request, response) => {
        void (async () => {
            const path = new URL(request.url ?? '/', 'http://localhost').pathname;
            const relative = path === BASE ? 'index.html' : path.slice(BASE.length);
            if (!path.startsWith(BASE) || normalize(relative).startsWith('..')) {
                response.writeHead(404).end();
                return;
            }
            try {
                let body = await readFile(join(distDir, relative));
                if (relative === 'sw.js' && version > 0) {
                    body = Buffer.concat([body, Buffer.from(`\n// changed worker ${String(version)}\n`)]);
                }
                response.writeHead(200, {
                    'content-type': TYPES[extname(relative)] ?? 'application/octet-stream',
                    'cache-control': 'no-cache',
                });
                response.end(body);
            } catch {
                response.writeHead(404).end();
            }
        })();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${String(port)}${BASE}`,
        changeWorker() {
            version += 1;
        },
        close: () =>
            new Promise<void>((resolve) => {
                server.close(() => {
                    resolve();
                });
                server.closeAllConnections();
            }),
    };
}
