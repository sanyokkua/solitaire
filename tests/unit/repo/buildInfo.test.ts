import { describe, expect, it } from 'vitest';
import { resolveBuildInfo } from '../../../scripts/build-info.mjs';

const NOW = new Date('2026-09-28T14:03:27.500Z');

describe('resolveBuildInfo', () => {
    it('carries the run number and the UTC build time', () => {
        expect(resolveBuildInfo({ GITHUB_RUN_NUMBER: '57' }, NOW)).toEqual({
            number: '57',
            time: '2026-09-28 14:03 UTC',
        });
    });

    it('trims the run number', () => {
        expect(resolveBuildInfo({ GITHUB_RUN_NUMBER: ' 57\n' }, NOW).number).toBe('57');
    });

    it.each([
        ['unset', {}],
        ['empty', { GITHUB_RUN_NUMBER: '' }],
        ['whitespace', { GITHUB_RUN_NUMBER: '  \t' }],
    ])('counts a %s run number as absent', (_name, env) => {
        expect(resolveBuildInfo(env, NOW)).toEqual({ number: null, time: '2026-09-28 14:03 UTC' });
    });

    it('reports UTC whatever the process time zone is', () => {
        const zone = process.env.TZ;
        try {
            for (const tz of ['Pacific/Auckland', 'America/Los_Angeles']) {
                process.env.TZ = tz;
                expect(resolveBuildInfo({}, new Date('2026-12-31T23:59:00Z')).time).toBe('2026-12-31 23:59 UTC');
            }
        } finally {
            if (zone === undefined) {
                delete process.env.TZ;
            } else {
                process.env.TZ = zone;
            }
        }
    });

    it('defaults to the current time', () => {
        expect(resolveBuildInfo({}).time).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);
    });
});
