// Resolves the build identity the app stamps into its footer and About sheet (D13): the CI run number, when the
// environment has one, and the UTC build time. Vite embeds the result as `__APP_BUILD__` (`vite.config.ts`).

/**
 * @param {Record<string, string | undefined>} env the build environment; `GITHUB_RUN_NUMBER` is set by GitHub Actions
 * @param {Date} now the build time, injectable for tests
 * @returns {{ number: string | null, time: string }} `number` is null when the run number is unset, empty or blank
 */
export function resolveBuildInfo(env, now = new Date()) {
    const number = env.GITHUB_RUN_NUMBER?.trim();
    return {
        number: number ? number : null,
        time: `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    };
}
