/**
 * Lifecycle-storage guard (design D15): the application lifecycle tests must reach browser storage only through an
 * injected storage gateway. Reads every `tests/component/appLifecycle*.test.tsx` under the current directory and fails,
 * naming the file and the rule, when one refers to ambient storage, builds the default gateway, or starts the app without injecting one. Fails as well when
 * there is no lifecycle test at all, so the guard cannot pass by having nothing to check.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const TEST_DIRECTORY = 'tests/component';
const LIFECYCLE_TEST = /^appLifecycle.*\.test\.tsx$/;

/** Each rule names a way for a lifecycle test to reach ambient storage, and says whether a source breaks it. */
const RULES = [
    ['ambient localStorage', (source) => /\blocalStorage\b/.test(source)],
    ['ambient sessionStorage', (source) => /\bsessionStorage\b/.test(source)],
    ['Storage.prototype', (source) => /\bStorage\.prototype\b/.test(source)],
    ['a bare createStorageGateway()', (source) => /\bcreateStorageGateway\(\s*\)/.test(source)],
    // startApp falls back to the default (browser storage) gateway unless one is passed in.
    ['startApp without an injected gateway', (source) => /\bstartApp\(/.test(source) && !/\bgateway\b/.test(source)],
];

function lifecycleTests() {
    try {
        return readdirSync(TEST_DIRECTORY)
            .filter((name) => LIFECYCLE_TEST.test(name))
            .sort();
    } catch {
        return [];
    }
}

const files = lifecycleTests();
const violations = files.flatMap((name) => {
    const source = readFileSync(join(TEST_DIRECTORY, name), 'utf-8');
    return RULES.filter(([, broken]) => broken(source)).map(([rule]) => `${name}: ${rule}`);
});

if (files.length === 0) {
    process.stderr.write(`lifecycle storage guard failed: no ${TEST_DIRECTORY}/appLifecycle*.test.tsx to check\n`);
    process.exitCode = 1;
} else if (violations.length > 0) {
    process.stderr.write(`lifecycle storage guard failed:\n${violations.map((line) => `  ${line}`).join('\n')}\n`);
    process.exitCode = 1;
} else {
    process.stdout.write(`lifecycle storage guard passed: ${files.join(', ')}\n`);
}
