import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { StrictMode } from 'react';
import { Provider } from 'react-redux';
import type { AppStore } from '../../src/app/store';
import { testStore, type TestStoreOptions } from './testStore';

export interface RenderWithStoreOptions extends TestStoreOptions {
    /** A store built ahead of render, e.g. to dispatch into it first. Overrides `preloadedState`/`deps`. */
    readonly store?: AppStore;
    /** Wraps the tree in `StrictMode`. */
    readonly strict?: boolean;
}

/** Renders `ui` inside a `Provider` around a {@link testStore}, or the given `store`. Returns the store alongside the usual render result. */
export function renderWithStore(ui: ReactElement, options: RenderWithStoreOptions = {}) {
    const store = options.store ?? testStore(options);
    const tree = <Provider store={store}>{ui}</Provider>;
    const view = render(options.strict ? <StrictMode>{tree}</StrictMode> : tree);
    return { store, ...view };
}
