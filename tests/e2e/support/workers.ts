import type { BrowserContext, Page } from '@playwright/test';

/**
 * What the page records about each `Worker` it creates, in creation order: the script URL, the first request posted to
 * it and whether it has answered anything.
 */
export interface WorkerTag {
    readonly index: number;
    readonly url: string;
    readonly firstRequest: { readonly type: unknown; readonly mode: unknown; readonly target: unknown } | null;
    readonly answered: boolean;
    /** Per mode, how many of its replies were a finished `findWinnable` selection that proved a deal winnable. */
    readonly winReplies: Readonly<Record<string, number>>;
}

type TagWindow = Window & {
    __solverWorkers?: WorkerTag[];
    /** Called, in the same task, right after the pool's first fill request is posted; a spec that needs to act while that fill is in flight sets it. */
    __afterPoolRequest?: (() => void) | undefined;
};

/**
 * Tags every `Worker` the page creates from the first script on (D8: the app runs the player's solver worker and the
 * deal pool's, from the same chunk). Register it before the page loads. It changes no behaviour: the wrapped
 * constructor and `postMessage` call the native ones.
 */
export async function tagWorkers(target: Page | BrowserContext): Promise<void> {
    await target.addInitScript(() => {
        interface MutableTag {
            index: number;
            url: string;
            firstRequest: WorkerTag['firstRequest'];
            answered: boolean;
            winReplies: Record<string, number>;
        }
        const tags: MutableTag[] = [];
        const tagOf = new WeakMap<Worker, MutableTag>();
        /** The mode of every request a worker was sent, by the request's id, so a reply is counted under the mode it answers (ids restart at 1 in each worker). */
        const modesOf = new WeakMap<Worker, Map<number, string>>();
        (window as TagWindow).__solverWorkers = tags;
        const Native = window.Worker;
        window.Worker = class TaggedWorker extends Native {
            constructor(scriptURL: string | URL, options?: WorkerOptions) {
                super(scriptURL, options);
                const tag: MutableTag = {
                    index: tags.length,
                    url: String(scriptURL),
                    firstRequest: null,
                    answered: false,
                    winReplies: {},
                };
                tags.push(tag);
                tagOf.set(this, tag);
                const modes = new Map<number, string>();
                modesOf.set(this, modes);
                this.addEventListener(
                    'message',
                    (event: MessageEvent<{ id?: number; type?: unknown; verdict?: unknown } | null>) => {
                        tag.answered = true;
                        const mode = event.data?.id === undefined ? undefined : modes.get(event.data.id);
                        if (mode !== undefined && event.data?.type === 'findWinnable' && event.data.verdict === 'win') {
                            tag.winReplies[mode] = (tag.winReplies[mode] ?? 0) + 1;
                        }
                    },
                );
            }

            override postMessage(message: unknown, options?: Transferable[] | StructuredSerializeOptions): void {
                const tag = tagOf.get(this);
                const posted = (message ?? {}) as { id?: number; mode?: unknown };
                if (posted.id !== undefined && typeof posted.mode === 'string')
                    modesOf.get(this)?.set(posted.id, posted.mode);
                if (tag?.firstRequest === null) {
                    const request = (message ?? {}) as {
                        type?: unknown;
                        mode?: unknown;
                        selection?: { target?: unknown };
                    };
                    tag.firstRequest = { type: request.type, mode: request.mode, target: request.selection?.target };
                }
                if (Array.isArray(options)) super.postMessage(message, options);
                else super.postMessage(message, options);
                const first = tag?.firstRequest;
                if (first?.type === 'findWinnable' && first.target !== 'any' && first.target !== undefined) {
                    // The fill was just posted and cannot have been answered yet: a hook here runs while it is in flight.
                    (window as TagWindow).__afterPoolRequest?.();
                    (window as TagWindow).__afterPoolRequest = undefined;
                }
            }
        };
    });
}

/**
 * Keeps the deal pool from ever starting (D8): it starts at the first idle period, through `requestIdleCallback` where
 * the browser has it and a 2 s timer otherwise, so an idle callback that never comes holds it in every engine. A spec
 * that must measure or observe the player's own search (not a deal served from the pool) registers it before the page
 * loads; the product needs no test hook for it.
 */
export async function holdDealPool(target: Page | BrowserContext): Promise<void> {
    await target.addInitScript(() => {
        window.requestIdleCallback = () => 0;
        window.cancelIdleCallback = () => undefined;
    });
}

/**
 * The player's solver worker for a winnable deal of `mode` at Difficulty Any (or at `target`): the earliest-created
 * worker whose first request is `findWinnable` for that mode with that target. The pool's worker never matches the
 * default, because every fill asks for one named grade. Needs {@link tagWorkers}; throws when there is no such worker
 * (for instance, the deal was served from the pool, so no player search ran).
 */
export async function playerWorker(page: Page, mode: string, target = 'any'): Promise<WorkerTag> {
    const tags = await allWorkers(page);
    const found = tags.find(
        ({ firstRequest }) =>
            firstRequest?.type === 'findWinnable' && firstRequest.mode === mode && firstRequest.target === target,
    );
    if (found === undefined) {
        throw new Error(`no player solver worker for a ${mode} deal among ${JSON.stringify(tags)}`);
    }
    return found;
}

/** Every worker the page has created so far, in creation order. Needs {@link tagWorkers}. */
export async function allWorkers(page: Page): Promise<readonly WorkerTag[]> {
    return page.evaluate(() => (window as TagWindow).__solverWorkers ?? []);
}

/** The deal pool's workers: those whose first request is a `findWinnable` for a named grade (the player's asks for `any`). */
export function poolWorkers(tags: readonly WorkerTag[]): readonly WorkerTag[] {
    return tags.filter(
        ({ firstRequest }) =>
            firstRequest?.type === 'findWinnable' && firstRequest.target !== 'any' && firstRequest.target !== undefined,
    );
}

/** The proven-deal replies of a worker, for `mode` or, without one, for every mode. */
const provenBy = (tag: WorkerTag, mode?: string): number =>
    mode === undefined
        ? Object.values(tag.winReplies).reduce((total, count) => total + count, 0)
        : (tag.winReplies[mode] ?? 0);

/**
 * How many deals the pool's pre-verification has proven so far for `mode` (every mode without one), counted from its
 * own completed selection replies, so a spec learns that the pool is warm from the worker itself and never by waiting a
 * fixed time. The pool fills the mode chosen on Home, so a deal proven for another mode does not make this one warm.
 */
export async function poolProven(page: Page, mode?: string): Promise<number> {
    return poolWorkers(await allWorkers(page)).reduce((total, tag) => total + provenBy(tag, mode), 0);
}
