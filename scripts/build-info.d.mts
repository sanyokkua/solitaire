export function resolveBuildInfo(
    env: Record<string, string | undefined>,
    now?: Date,
): { number: string | null; time: string };
