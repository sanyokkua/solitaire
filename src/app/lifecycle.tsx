import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { App } from '../App';
import { createClockTicker, type ClockTimers } from '../features/game/clockTicker';
import { loadInitialState } from '../features/persistence/persistenceLoader';
import { createPersistenceWriter, type WriterTimers } from '../features/persistence/persistenceWriter';
import { createLocaleController } from '../i18n/localeController';
import type { InstallGateway } from '../pwa/installGateway';
import type { PwaGateway } from '../pwa/pwaGateway';
import { installableChanged, noticeRaised, systemMotionChanged, visibilityChanged } from './appSlice';
import { createDealPoolController, type IdleScheduler } from './dealPoolController';
import { createSavePort } from './savePort';
import { createAppStore, type AppStore } from './store';
import { createThemeController } from './themeController';
import { assembleThunkExtra, type ThunkExtra } from './thunkExtra';

/** The media query behind the device's reduced-motion request. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Replacements for the parts of the application that tests need to control; every part defaults to production. */
export interface StartAppDeps {
    /** Thunk dependencies (`gateway`, `now`, `delay`, `dealService`, `today`); the same gateway loads and saves. */
    readonly extra?: Partial<ThunkExtra>;
    /** The clock ticker's timing; `now` defaults to the store's own `now`, so both accrue from one clock. */
    readonly ticker?: Partial<ClockTimers>;
    /** The persistence writer's timing. */
    readonly writer?: Partial<WriterTimers>;
    /**
     * The real PWA gateways, supplied only by `main.tsx`. Without them the app has no update or install offer, so
     * tests and dev never start a service worker; tests inject fakes to drive the update-ready notice and Install.
     */
    readonly pwa?: { readonly update: PwaGateway; readonly install: InstallGateway };
    /** When the deal pool starts filling; defaults to the first idle period (`defaultIdleScheduler`, D8). */
    readonly poolScheduler?: IdleScheduler;
}

/** The running application: its store (for tests and tooling) and the way to tear everything down. */
export interface RunningApp {
    readonly store: AppStore;
    /**
     * Stops the theme, locale and deal pool controllers, ticker and writer, removes the page listeners, unmounts the UI
     * and disposes the deal service. Idempotent.
     */
    dispose(): void;
}

/**
 * Starts the application (D1): everything that happens outside React lives here, so it runs once, is not repeated by
 * StrictMode's double effects and can be tested without a browser page.
 *
 * In order: the saved record is read (`loadInitialState`) and the store is created from it; the document's visibility,
 * the device's reduced-motion request and the loader's notices go into the store; then the theme and locale
 * controllers write the appearance attributes and `lang`/`title` onto the document element, so the first paint
 * already has the stored theme and language (LO "The document follows the active language"); then the clock
 * ticker and the persistence writer start, so both begin from the final start-up state; then the page listeners are
 * attached (`visibilitychange` updates the store and saves when the page is hidden, `pagehide` saves, the media query
 * updates the store; the media query is optional and skipped where the browser has none); the PWA gateways, when
 * given, raise the update-ready notice and set `installable`; the deal pool controller is started, and from the first
 * idle period (`deps.poolScheduler`) keeps the deal service's pool filling for the selected mode and switch while the
 * page is visible (D8); finally the UI renders into `root`.
 *
 * The one gateway in `deps.extra` (the browser's storage by default) serves the loader, the thunks and the writer.
 * `dispose()` does not save: a caller that wants the pending write flushes it first.
 */
export function startApp(root: HTMLElement, deps: StartAppDeps = {}): RunningApp {
    const saver = createSavePort();
    const gateways = deps.pwa;
    const pwaPort: Partial<ThunkExtra> =
        gateways === undefined
            ? {}
            : {
                  pwa: {
                      applyUpdate: () => gateways.update.applyUpdate(),
                      promptInstall: () => gateways.install.prompt(),
                  },
              };
    const extra = assembleThunkExtra({ saver, ...pwaPort, ...deps.extra });

    const loaded = loadInitialState(extra.gateway, extra.languages());
    const store = createAppStore({ preloadedState: loaded.preloadedState, deps: extra });

    const reducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : undefined;
    store.dispatch(visibilityChanged(document.visibilityState === 'visible'));
    store.dispatch(systemMotionChanged(reducedMotion?.matches ?? false));
    loaded.notices.forEach((notice) => store.dispatch(noticeRaised(notice)));

    const themeController = createThemeController(
        store,
        document.documentElement,
        typeof window.matchMedia === 'function' ? (query) => window.matchMedia(query) : undefined,
    );
    const localeController = createLocaleController(store, document.documentElement);

    const ticker = createClockTicker(store, { now: extra.now, ...deps.ticker });
    const writer = createPersistenceWriter(store, extra.gateway, deps.writer);
    saver.connect(writer);

    const onVisibilityChange = (): void => {
        const visible = document.visibilityState === 'visible';
        store.dispatch(visibilityChanged(visible));
        if (!visible) writer.flush();
    };
    const onPageHide = (): void => {
        writer.flush();
    };
    const onMotionChange = (event: MediaQueryListEvent): void => {
        store.dispatch(systemMotionChanged(event.matches));
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    if (typeof reducedMotion?.addEventListener === 'function') {
        reducedMotion.addEventListener('change', onMotionChange);
    }

    let disposed = false;
    gateways?.update.onUpdateReady(() => {
        if (!disposed) store.dispatch(noticeRaised('update-ready'));
    });
    gateways?.install.onAvailabilityChange((available) => {
        if (!disposed) store.dispatch(installableChanged(available));
    });

    const poolController = createDealPoolController(store, extra.dealService, deps.poolScheduler);

    const reactRoot = createRoot(root);
    reactRoot.render(
        <StrictMode>
            <Provider store={store}>
                <App />
            </Provider>
        </StrictMode>,
    );

    return {
        store,
        dispose: () => {
            if (disposed) return;
            disposed = true;
            themeController.dispose();
            localeController.dispose();
            poolController.dispose();
            ticker.dispose();
            writer.dispose();
            document.removeEventListener('visibilitychange', onVisibilityChange);
            window.removeEventListener('pagehide', onPageHide);
            if (typeof reducedMotion?.removeEventListener === 'function') {
                reducedMotion.removeEventListener('change', onMotionChange);
            }
            reactRoot.unmount();
            extra.dealService.dispose();
        },
    };
}
