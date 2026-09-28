/**
 * Built-artifact validation (design D11). Every check is a pure function over a `dist` directory path that returns a
 * list of problems (empty when the artifact is fine); the CLI runs all four against `dist` (or the path given) and
 * exits non-zero, printing each problem, when any is found.
 *
 * Check 4 inspects only what the app LOADS: HTML `src`/`href` (anchors excluded), CSS `url()`/`@import`, the manifest
 * URLs, the service worker's precache entries and `importScripts`, and the string arguments of `import()`,
 * `new Worker()`, `new URL(…, import.meta.url)` and `importScripts()` in built scripts. Plain URL text is not a load.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const BASE = '/solitaire/';
const FONT_EXTENSION = /\.(woff2?|ttf|otf)$/;
const ICON_EXTENSION = /\.(png|svg|ico)$/;
/** The workbox runtime is imported by `sw.js` itself, not precached. */
const WORKBOX_RUNTIME = /^workbox-[\w-]+\.js$/;
const QUOTED = String.raw`(?:"([^"]*)"|'([^']*)'|\`([^\`]*)\`)`;

const listFiles = (dist) =>
    readdirSync(dist, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(dist, join(entry.parentPath, entry.name)).split('\\').join('/'))
        .sort();

const read = (dist, path) => readFileSync(join(dist, path), 'utf-8');
const first = (groups) => groups.find((value) => value !== undefined) ?? '';
const isForeign = (reference) => /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(reference.trim());
const isSelfContained = (reference) => /^(?:data:|blob:|#|about:)/i.test(reference.trim()) || reference.trim() === '';

/** `src`/`href` values of every non-anchor tag in an HTML document. */
function htmlLoads(html) {
    const loads = [];
    for (const [, , attributes] of html.matchAll(/<(?!a[\s>/])([a-z][\w-]*)([^>]*)>/gi)) {
        for (const match of attributes.matchAll(/(?<![\w-])(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
            loads.push(first(match.slice(1)));
        }
    }
    return loads;
}

/** `url()` and `@import` targets of a stylesheet. */
function cssLoads(css) {
    const loads = [...css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi)].map((m) => first(m.slice(1)));
    for (const match of css.matchAll(new RegExp(String.raw`@import\s+${QUOTED}`, 'gi')))
        loads.push(first(match.slice(1)));
    return loads;
}

/** String arguments of the loading calls a built script can make. */
function scriptLoads(script) {
    const loads = [];
    const patterns = [
        new RegExp(String.raw`\bimport\(\s*${QUOTED}`, 'g'),
        new RegExp(String.raw`\bnew\s+Worker\(\s*${QUOTED}`, 'g'),
        new RegExp(String.raw`\bnew\s+URL\(\s*${QUOTED}\s*,[^)]*import\.meta\.url`, 'g'),
    ];
    for (const pattern of patterns) {
        for (const match of script.matchAll(pattern)) loads.push(first(match.slice(1)));
    }
    for (const call of script.matchAll(/\bimportScripts\(([^)]*)\)/g)) {
        for (const match of call[1].matchAll(new RegExp(QUOTED, 'g'))) loads.push(first(match.slice(1)));
    }
    return loads;
}

/** The `url` of each precache entry in a generated `sw.js`. */
function precacheEntries(sw) {
    return [...sw.matchAll(/\burl\s*:\s*(?:"([^"]*)"|'([^']*)')/g)].map((match) => first(match.slice(1)));
}

const asPath = (reference) => reference.replace(/[?#].*$/, '');

/** Check 1: every local `src`/`href` in `index.html` starts with `/solitaire/`. */
export function checkLocalReferences(dist) {
    const path = 'index.html';
    if (!existsSync(join(dist, path))) return [`${path} is missing`];
    return htmlLoads(read(dist, path))
        .filter((ref) => !isSelfContained(ref) && !isForeign(ref) && !ref.startsWith(BASE))
        .map((ref) => `${path}: local reference "${ref}" does not start with ${BASE}`);
}

/** Check 2: manifest start_url/scope, standalone display, and icons that exist including a maskable one. */
export function checkManifest(dist) {
    const path = 'manifest.webmanifest';
    if (!existsSync(join(dist, path))) return [`${path} is missing`];
    const manifest = JSON.parse(read(dist, path));
    const problems = [];
    for (const key of ['start_url', 'scope']) {
        if (manifest[key] !== BASE) problems.push(`${path}: ${key} is "${String(manifest[key])}", expected ${BASE}`);
    }
    if (manifest.display !== 'standalone') problems.push(`${path}: display is not standalone`);
    const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
    for (const icon of icons) {
        const src = String(icon.src);
        if (!src.startsWith(BASE) || !existsSync(join(dist, asPath(src.slice(BASE.length))))) {
            problems.push(`${path}: icon "${src}" does not exist under ${BASE}`);
        }
    }
    if (
        !icons.some((icon) =>
            String(icon.purpose ?? '')
                .split(/\s+/)
                .includes('maskable'),
        )
    ) {
        problems.push(`${path}: no maskable icon`);
    }
    return problems;
}

/** Check 3: `sw.js` exists and precaches the shell, the manifest, and every emitted script, style, font and icon. */
export function checkServiceWorker(dist) {
    if (!existsSync(join(dist, 'sw.js'))) return ['sw.js is missing'];
    const precached = new Set(precacheEntries(read(dist, 'sw.js')).map(asPath));
    const files = listFiles(dist);
    const required = new Set(['index.html', 'manifest.webmanifest']);
    for (const file of files) {
        const isScript = file.endsWith('.js') && file !== 'sw.js' && !WORKBOX_RUNTIME.test(file);
        if (isScript || file.endsWith('.css') || FONT_EXTENSION.test(file) || ICON_EXTENSION.test(file))
            required.add(file);
    }
    const problems = [...required]
        .filter((file) => !precached.has(file))
        .map((file) => `sw.js does not precache ${file}`);
    if (!files.some((file) => /(?:^|\/)solver\.worker[^/]*\.js$/.test(file)))
        problems.push('the solver worker chunk is missing');
    return problems;
}

/** Check 4: no reference the app loads points to another origin. */
export function checkNoThirdPartyLoads(dist) {
    const files = listFiles(dist);
    const loads = [];
    const add = (source, refs) => refs.forEach((ref) => loads.push([source, ref]));
    for (const file of files) {
        if (file.endsWith('.html')) add(file, htmlLoads(read(dist, file)));
        else if (file.endsWith('.css')) add(file, cssLoads(read(dist, file)));
        else if (file.endsWith('.js')) {
            const script = read(dist, file);
            add(file, scriptLoads(script));
            if (file === 'sw.js') add(file, precacheEntries(script));
        } else if (file === 'manifest.webmanifest') {
            const manifest = JSON.parse(read(dist, file));
            const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
            add(
                file,
                [manifest.start_url, manifest.scope, ...icons.map((icon) => icon.src)].filter(
                    (v) => typeof v === 'string',
                ),
            );
        }
    }
    return loads.filter(([, ref]) => isForeign(ref)).map(([source, ref]) => `${source}: loads third-party "${ref}"`);
}

export function validateArtifact(dist) {
    return [checkLocalReferences, checkManifest, checkServiceWorker, checkNoThirdPartyLoads].flatMap((check) =>
        check(dist),
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const dist = process.argv[2] ?? 'dist';
    if (!existsSync(dist)) {
        process.stderr.write(`artifact validation failed: ${dist} does not exist (run the build first)\n`);
        process.exitCode = 1;
    } else {
        const problems = validateArtifact(dist);
        if (problems.length > 0) {
            process.stderr.write(`artifact validation failed:\n${problems.map((line) => `  ${line}`).join('\n')}\n`);
            process.exitCode = 1;
        } else {
            process.stdout.write(`artifact validation passed: ${dist}\n`);
        }
    }
}
