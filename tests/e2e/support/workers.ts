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
}

type TagWindow = Window & { __solverWorkers?: WorkerTag[] };

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
        }
        const tags: MutableTag[] = [];
        const tagOf = new WeakMap<Worker, MutableTag>();
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
                };
                tags.push(tag);
                tagOf.set(this, tag);
                this.addEventListener('message', () => {
                    tag.answered = true;
                });
            }

            override postMessage(message: unknown, options?: Transferable[] | StructuredSerializeOptions): void {
                const tag = tagOf.get(this);
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
 * The player's solver worker for a winnable deal of `mode` at Difficulty Any: the earliest-created worker whose first
 * request is `findWinnable` for that mode with the `any` target. The pool's worker never matches, because every fill
 * asks for one named grade. Needs {@link tagWorkers}; throws when there is no such worker (for instance, the deal was
 * served from the pool, so no player search ran).
 */
export async function playerWorker(page: Page, mode: string): Promise<WorkerTag> {
    const tags = await page.evaluate(() => (window as TagWindow).__solverWorkers ?? []);
    const found = tags.find(
        ({ firstRequest }) =>
            firstRequest?.type === 'findWinnable' && firstRequest.mode === mode && firstRequest.target === 'any',
    );
    if (found === undefined) {
        throw new Error(`no player solver worker for a ${mode} deal among ${JSON.stringify(tags)}`);
    }
    return found;
}
