import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { noticeDismissed, noticeRaised, type NoticeId } from '../../src/app/appSlice';
import { createAppStore } from '../../src/app/store';
import { Notices } from '../../src/ui/components/Notices';
import { GameScreen } from '../../src/ui/screens/GameScreen';
import { fakeDealService } from '../fixtures/dealService';
import { playedGame } from '../fixtures/games';
import { restoreMatchMedia, stubMatchMedia } from '../support/matchMedia';

const DEAD_END = 'No moves left. Undo a few steps or deal again.';
const NO_REDEALS = 'No redeals left';

function setup(ui = <Notices />) {
    const store = createAppStore({ preloadedState: { game: playedGame() }, deps: { dealService: fakeDealService() } });
    const view = render(<Provider store={store}>{ui}</Provider>);
    return { store, view };
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

    it('No redeals: shows "No redeals left" and removes it after 3.2 s', () => {
        vi.useFakeTimers();
        const { store } = setup();
        raise(store, 'no-redeals');
        expect(screen.getByText(NO_REDEALS)).toBeInTheDocument();
        advance(3200);
        expect(screen.queryByText(NO_REDEALS)).toBeNull();
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
                <Notices />
            </>,
        );
        screen.getByRole('button', { name: 'Elsewhere' }).focus();
        raise(store, 'storage-write');
        raise(store, 'dead-end');
        expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
    });
});

describe('Notices in the Game frame', () => {
    it('sits outside the body, after the announcer, so it can never move the board or toolbar', () => {
        stubMatchMedia([]);
        const { store, view } = setup(<GameScreen />);
        const before = [...(view.container.querySelector('.screen--game')?.children ?? [])];
        raise(store, 'storage-write');
        raise(store, 'dead-end');

        const host = view.container.querySelector('.notices');
        expect(host).not.toBeNull();
        expect(view.container.querySelector('.game-body')).not.toContainElement(host as HTMLElement);
        expect(host?.parentElement).toBe(view.container.querySelector('.screen--game'));
        // The frame gained no children on raising: the host was already there.
        expect([...(view.container.querySelector('.screen--game')?.children ?? [])]).toEqual(before);
    });
});
