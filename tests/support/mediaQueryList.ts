/**
 * The one `MediaQueryList` fake. It imports nothing from Testing Library or the DOM, so `tests/setup.ts` can use it in
 * either environment; `matchMedia.ts` builds the installers tests call on top of it.
 */

type Listener = (event: MediaQueryListEvent) => void;

/** What every `MediaQueryList` returned for one query shares: whether it matches and who listens for `change`. */
export interface MediaQueryState {
    matches: boolean;
    readonly listeners: Set<Listener>;
}

export interface MediaQueryListOptions {
    /** Leaves out `addEventListener` and `removeEventListener`, as an old browser's list has none. */
    readonly withoutEventListener?: boolean;
}

export function createMediaQueryState(matches = false): MediaQueryState {
    return { matches, listeners: new Set() };
}

/** A query list over `state`: `matches` is read live, and listeners are really registered and removed. */
export function createMediaQueryList(
    query: string,
    state: MediaQueryState = createMediaQueryState(),
    { withoutEventListener = false }: MediaQueryListOptions = {},
): MediaQueryList {
    const add = (listener: Listener): void => {
        state.listeners.add(listener);
    };
    const remove = (listener: Listener): void => {
        state.listeners.delete(listener);
    };
    const list = {
        get matches() {
            return state.matches;
        },
        media: query,
        onchange: null,
        addListener: add,
        removeListener: remove,
        ...(withoutEventListener
            ? {}
            : {
                  addEventListener: (_type: string, listener: Listener) => {
                      add(listener);
                  },
                  removeEventListener: (_type: string, listener: Listener) => {
                      remove(listener);
                  },
              }),
        dispatchEvent: (event: Event) => {
            state.listeners.forEach((listener) => {
                listener(event as MediaQueryListEvent);
            });
            return true;
        },
    };
    return list as unknown as MediaQueryList;
}

export interface MatchMediaFake {
    /** A `window.matchMedia` with one shared state per query. */
    readonly matchMedia: (query: string) => MediaQueryList;
    /** Sets whether `query` matches and fires its registered listeners. */
    set(query: string, matches: boolean): void;
    /** How many `change` listeners are registered for `query`. */
    listenerCount(query: string): number;
}

/** A `matchMedia` in which exactly the queries in `initial` match (when true) until `set` says otherwise. */
export function createMatchMedia(
    initial: Readonly<Record<string, boolean>> = {},
    options: MediaQueryListOptions = {},
): MatchMediaFake {
    const states = new Map<string, MediaQueryState>();
    const stateFor = (query: string): MediaQueryState => {
        let state = states.get(query);
        if (!state) {
            state = createMediaQueryState(initial[query] ?? false);
            states.set(query, state);
        }
        return state;
    };
    return {
        matchMedia: (query) => createMediaQueryList(query, stateFor(query), options),
        set(query, matches) {
            const state = stateFor(query);
            state.matches = matches;
            state.listeners.forEach((listener) => {
                listener({ matches } as MediaQueryListEvent);
            });
        },
        listenerCount: (query) => stateFor(query).listeners.size,
    };
}
