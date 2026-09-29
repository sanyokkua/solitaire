import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { noticeDismissed, noticeRaised, setRoute, type NoticeId } from '../../src/app/appSlice';
import { App } from '../../src/App';
import { writeFailed, writeSucceeded } from '../../src/features/persistence/persistenceSlice';
import { Notices } from '../../src/ui/components/Notices';
import { playedGame } from '../fixtures/games';
import { restoreMatchMedia, stubMatchMedia } from '../support/matchMedia';
import { renderWithStore, type RenderWithStoreOptions } from '../support/renderWithStore';

const DEAD_END = 'No moves left. Undo a few steps or deal again.';
const NO_REDEALS = 'No redeals left';

function setup(ui = <Notices onUpdate={() => undefined} />, locale?: 'en' | 'uk') {
    const view = renderWithStore(ui, {
        preloadedState: { game: playedGame(), ...(locale === undefined ? {} : { preferences: { locale } }) },
    });
    return { store: view.store, view };
}

function renderApp(options: RenderWithStoreOptions = {}) {
    stubMatchMedia([]);
    return renderWithStore(<App />, options);
}

function raise(store: ReturnType<typeof setup>['store'], id: NoticeId) {
    act(() => {
        store.dispatch(noticeRaised(id));
    });
}

function advance(ms: number) {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}

afterEach(() => {
    vi.useRealTimers();
    restoreMatchMedia();
});

describe('Notices', () => {
    it('renders nothing visible while no notice is raised', () => {
        const { view } = setup();
        expect(view.container.querySelector('.notices')).toBeEmptyDOMElement();
    });

    it('Dead end: shows the message and removes it after 3.2 s, not before', () => {
        vi.useFakeTimers();
        const { store } = setup();
        raise(store, 'dead-end');
        expect(screen.getByText(DEAD_END)).toBeInTheDocument();

        advance(3100);
        expect(screen.getByText(DEAD_END)).toBeInTheDocument();
        advance(100);
        expect(screen.queryByText(DEAD_END)).toBeNull();
        expect(store.getState().app.notices).toEqual([]);
    });

    // covers: KS-MOVE-05
    it('No redeals: shows "No redeals left" and removes it after 3.2 s', () => {
        vi.useFakeTimers();
        const { store } = setup();
        raise(store, 'no-redeals');
        expect(screen.getByText(NO_REDEALS)).toBeInTheDocument();
        advance(3200);
        expect(screen.queryByText(NO_REDEALS)).toBeNull();
    });

    it('Code copied: shows "Deal code copied" and removes it after 3.2 s, with no live region', () => {
        vi.useFakeTimers();
        const { store } = setup();
        raise(store, 'code-copied');
        const node = screen.getByText('Deal code copied');
        expect(node).toBeInTheDocument();
        expect(node.closest('[role="status"], [role="alert"], [aria-live]')).toBeNull();

        advance(3200);
        expect(screen.queryByText('Deal code copied')).toBeNull();
    });

    it('a re-raise after the dismissal shows the message again, for another 3.2 s', () => {
        vi.useFakeTimers();
        const { store } = setup();
        raise(store, 'dead-end');
        advance(3200);
        expect(screen.queryByText(DEAD_END)).toBeNull();

        raise(store, 'dead-end');
        expect(screen.getByText(DEAD_END)).toBeInTheDocument();
        advance(3100);
        expect(screen.getByText(DEAD_END)).toBeInTheDocument();
        advance(100);
        expect(screen.queryByText(DEAD_END)).toBeNull();
    });

    it('stops the timer when the notice is dismissed early, so a later re-raise gets its full time', () => {
        vi.useFakeTimers();
        const { store } = setup();
        raise(store, 'dead-end');
        advance(3000);
        act(() => {
            store.dispatch(noticeDismissed('dead-end'));
        });
        raise(store, 'dead-end');
        advance(1000);
        expect(screen.getByText(DEAD_END)).toBeInTheDocument();
    });

    it('does not speak the dead-end and no-redeals messages: no live region around them', () => {
        const { store } = setup();
        raise(store, 'dead-end');
        raise(store, 'no-redeals');
        for (const text of [DEAD_END, NO_REDEALS]) {
            const node = screen.getByText(text);
            expect(node.closest('[role="status"], [role="alert"], [aria-live]')).toBeNull();
        }
    });

    it.each([
        ['storage-read', 'Saved data could not be read. A fresh start was made and the old data was kept as a backup.'],
        [
            'storage-read-only',
            'Saved data could not be read or backed up, so this session will not save your progress.',
        ],
        ['storage-write', 'Your progress could not be saved.'],
    ] as const)('%s is its own status with a Dismiss button, and stays until dismissed', (id, words) => {
        vi.useFakeTimers();
        const { store } = setup();
        raise(store, id);

        const status = screen.getByRole('status');
        expect(status).toHaveTextContent(words);
        advance(60_000);
        expect(screen.getByRole('status')).toBeInTheDocument();

        fireEvent.click(within(status).getByRole('button', { name: 'Dismiss' }));
        expect(screen.queryByRole('status')).toBeNull();
        expect(store.getState().app.notices).toEqual([]);
    });

    it('shows every raised notice, one message per id', () => {
        const { store } = setup();
        raise(store, 'storage-write');
        raise(store, 'storage-write');
        raise(store, 'dead-end');
        expect(screen.getAllByRole('status')).toHaveLength(1);
        expect(screen.getByText(DEAD_END)).toBeInTheDocument();
    });

    it('never takes focus when a notice appears', () => {
        const { store } = setup(
            <>
                <button type="button">Elsewhere</button>
                <Notices onUpdate={() => undefined} />
            </>,
        );
        screen.getByRole('button', { name: 'Elsewhere' }).focus();
        raise(store, 'storage-write');
        raise(store, 'dead-end');
        raise(store, 'update-ready');
        expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
    });

    it('shows translated text and a translated Dismiss button, in Ukrainian', () => {
        vi.useFakeTimers();
        const { store } = setup(<Notices onUpdate={() => undefined} />, 'uk');
        raise(store, 'dead-end');
        raise(store, 'storage-write');

        expect(screen.getByText('Ходів не залишилось. Скасуйте кілька ходів або здайте нову гру.')).toBeInTheDocument();
        const status = screen.getByRole('status');
        expect(status).toHaveTextContent('Не вдалося зберегти прогрес.');
        expect(within(status).getByRole('button', { name: 'Закрити' })).toBeInTheDocument();
    });
});

// covers: KS-PWA-03
describe('Update-ready notice', () => {
    it('stays until Later, and Later dismisses it', () => {
        vi.useFakeTimers();
        const { store } = setup();
        raise(store, 'update-ready');
        expect(screen.getByText('A new version is ready.')).toBeInTheDocument();

        advance(60_000);
        expect(screen.getByText('A new version is ready.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Later' }));
        expect(screen.queryByText('A new version is ready.')).toBeNull();
        expect(store.getState().app.notices).toEqual([]);
    });

    it('shows the warning text when saving is read-only or the last save failed', () => {
        const { store } = renderWithStore(<Notices onUpdate={() => undefined} />, {
            preloadedState: { game: playedGame(), persistence: { readOnly: true, lastError: 'read' } },
        });
        raise(store, 'update-ready');

        expect(screen.getByText('A new version is ready. The current game will not be kept.')).toBeInTheDocument();
    });

    it('keeps its text as decided when it appeared, whatever the storage does afterwards', () => {
        const { store } = setup();
        raise(store, 'update-ready');
        expect(screen.getByText('A new version is ready.')).toBeInTheDocument();

        act(() => {
            store.dispatch(writeFailed());
        });
        expect(screen.getByText('A new version is ready.')).toBeInTheDocument();
    });

    it('keeps the warning text once shown, even after a save succeeds', () => {
        const { store } = setup();
        act(() => {
            store.dispatch(writeFailed());
        });
        raise(store, 'update-ready');
        expect(screen.getByText('A new version is ready. The current game will not be kept.')).toBeInTheDocument();

        act(() => {
            store.dispatch(writeSucceeded());
        });
        expect(screen.getByText('A new version is ready. The current game will not be kept.')).toBeInTheDocument();
    });

    it('is announced politely and does not take focus', () => {
        const { store } = setup();
        raise(store, 'update-ready');
        const status = screen.getByRole('status');
        expect(status).toHaveTextContent('A new version is ready.');
        expect(document.activeElement).not.toBe(within(status).getByRole('button', { name: 'Update' }));
    });

    it('Update calls the handler', () => {
        const onUpdate = vi.fn();
        const { store } = setup(<Notices onUpdate={onUpdate} />);
        raise(store, 'update-ready');

        fireEvent.click(screen.getByRole('button', { name: 'Update' }));

        expect(onUpdate).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['Enter', '{Enter}'],
        ['Space', ' '],
    ])('both buttons work by keyboard (%s)', async (_name, key) => {
        const user = userEvent.setup();
        const onUpdate = vi.fn();
        const { store } = setup(<Notices onUpdate={onUpdate} />);
        raise(store, 'update-ready');

        screen.getByRole('button', { name: 'Update' }).focus();
        await user.keyboard(key);
        expect(onUpdate).toHaveBeenCalledTimes(1);

        raise(store, 'update-ready');
        screen.getByRole('button', { name: 'Later' }).focus();
        await user.keyboard(key);
        expect(store.getState().app.notices).toEqual([]);
    });

    // covers: KS-A11Y-04
    it('Update and Later reuse the notice-dismiss class, which carries the 44x44 coarse-pointer hit area rule', () => {
        const { store } = setup();
        raise(store, 'update-ready');

        expect(screen.getByRole('button', { name: 'Update' })).toHaveClass('notice-dismiss');
        expect(screen.getByRole('button', { name: 'Later' })).toHaveClass('notice-dismiss');
    });

    it('shows translated text in Ukrainian', () => {
        const { store } = setup(<Notices onUpdate={() => undefined} />, 'uk');
        raise(store, 'update-ready');

        expect(screen.getByText('Доступна нова версія.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Оновити' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Пізніше' })).toBeInTheDocument();
    });
});

describe('Notices at the app level', () => {
    it('shows a storage notice on Home', () => {
        const { store, container } = renderApp();
        raise(store, 'storage-read');

        const host = container.querySelector('.notices');
        expect(host).toHaveTextContent(
            'Saved data could not be read. A fresh start was made and the old data was kept as a backup.',
        );
    });

    it('stays mounted, and keeps showing notices, across a route change', () => {
        const { store, container } = renderApp();
        raise(store, 'storage-write');
        const host = () => container.querySelector('.notices');
        expect(host()).not.toBeEmptyDOMElement();

        act(() => {
            store.dispatch(setRoute('game'));
        });

        expect(host()).not.toBeEmptyDOMElement();
    });
});
