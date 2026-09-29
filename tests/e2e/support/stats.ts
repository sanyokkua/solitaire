/** Sorted-copy median; 0 for no values. */
export function median(values: readonly number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    const upper = sorted[middle] ?? 0;
    return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2;
}

/** Nearest-rank percentile: the value at rank ceil(p * n) of the sorted values; 0 for no values. */
export function percentile(values: readonly number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.max(1, Math.ceil(p * sorted.length)) - 1] ?? 0;
}
