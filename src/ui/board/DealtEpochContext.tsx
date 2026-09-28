import { createContext } from 'react';

/** The game epoch whose deal animation has been claimed, kept outside the game slice because it is UI-only. */
export interface DealtEpochStore {
    get(): number | null;
    set(epoch: number | null): void;
}

/** A store that has claimed no epoch yet. */
export function createDealtEpochStore(): DealtEpochStore {
    let dealt: number | null = null;
    return {
        get: () => dealt,
        set: (epoch) => {
            dealt = epoch;
        },
    };
}

/** Provided once by `App`; without a provider `Board` plays no deal animation. */
export const DealtEpochContext = createContext<DealtEpochStore | null>(null);
