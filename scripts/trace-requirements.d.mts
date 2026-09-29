export const MATRIX_PATH: string;
export const MANUAL_CHECKS_PATH: string;

export interface Requirement {
    readonly name: string;
    readonly ids: string[];
}
export interface CapabilityRequirement extends Requirement {
    readonly capability: string;
}
export interface Analysis {
    /** Every id a main-spec requirement cites, in id order. */
    readonly ids: string[];
    readonly citedBy: Map<string, { capability: string; name: string }[]>;
    readonly tests: Map<string, string[]>;
    readonly manual: Map<string, string[]>;
    /** Ids a test or a manual check declares that no main or delta spec cites. */
    readonly unknown: { source: string; id: string }[];
    readonly uncovered: { id: string; requirements: { capability: string; name: string }[] }[];
    /** Ids only the delta specs of active changes cite, still without a test or a manual check. */
    readonly deltaOnlyUncovered: string[];
}

export function extractIds(text: string): string[];
export function parseRequirements(spec: string): Requirement[];
export function collectRequirements(root: string): CapabilityRequirement[];
export function collectDeltaIds(root: string): Set<string>;
export function collectTestCoverage(root: string): { file: string; ids: string[] }[];
export function parseManualChecks(text: string): Requirement[];
export function analyze(root: string): Analysis;
export function uncoveredProblems(analysis: Pick<Analysis, 'uncovered'>): string[];
export function renderMatrix(analysis: Analysis): string;
export function formatMatrix(markdown: string): Promise<string>;
export function generateMatrix(root: string): Promise<string>;
export function writeMatrix(root: string): Promise<Analysis>;
