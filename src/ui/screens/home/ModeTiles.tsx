import { useRef, type KeyboardEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import type { Mode } from '../../../domain/types';
import { preferenceSet, selectPreference } from '../../../features/preferences/preferencesSlice';
import { formatDate } from '../../../i18n/translate';
import { useTranslate } from '../../../i18n/useTranslate';
import { formatBank, formatTime } from '../../format';
import { useToday } from '../../useToday';

interface Tile {
    readonly mode: Mode;
    /** The corner index: a number, or `$` for Vegas; Daily shows today's UTC day instead. */
    readonly index: string;
    /** The suit glyph (text presentation); `home.css` inks the tile from its `data-suit`. */
    readonly suit: 'spades' | 'hearts' | 'diamonds' | 'clubs';
    readonly glyph: string;
}

const TILES: readonly Tile[] = [
    { mode: 'draw1', index: '1', suit: 'spades', glyph: '\u2660\uFE0E' },
    { mode: 'draw3', index: '3', suit: 'hearts', glyph: '\u2665\uFE0E' },
    { mode: 'vegas', index: '$', suit: 'diamonds', glyph: '\u2666\uFE0E' },
    { mode: 'daily', index: '', suit: 'clubs', glyph: '\u2663\uFE0E' },
];

/** Home's "Choose a game" group (6.2, HO "Mode choice"): four playing-card radios, a roving-tabindex group. */
export function ModeTiles() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const selected = useAppSelector((state) => selectPreference(state, 'selectedMode'));
    const locale = useAppSelector((state) => state.preferences.locale);
    const modes = useAppSelector((state) => state.stats.modes);
    const dayKey = useToday();
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);

    const day = new Date(`${dayKey}T00:00:00Z`);

    function select(mode: Mode): void {
        dispatch(preferenceSet({ key: 'selectedMode', value: mode }));
    }

    function focusAndSelect(index: number): void {
        const wrapped = (index + TILES.length) % TILES.length;
        const tile = TILES[wrapped];
        if (tile === undefined) return;
        select(tile.mode);
        buttons.current[wrapped]?.focus();
    }

    function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            event.preventDefault();
            focusAndSelect(index + 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusAndSelect(index - 1);
        }
    }

    function bestOf(mode: Mode): string {
        const { bestTimeMs, bestScore } = modes[mode];
        if (mode === 'vegas' ? bestScore === null : bestTimeMs === null) return t('home.modes.noRecord');
        const value = mode === 'vegas' ? formatBank(bestScore ?? 0) : formatTime(Math.floor((bestTimeMs ?? 0) / 1000));
        return t('home.modes.best', { value });
    }

    return (
        <>
            <div className="section-label">{t('home.section.choose')}</div>
            <div className="mode-row" role="radiogroup" aria-label={t('home.modes.label')}>
                {TILES.map((tile, index) => {
                    const { mode } = tile;
                    const isSelected = mode === selected;
                    const id = `mode-${mode}`;
                    const corner = mode === 'daily' ? String(day.getUTCDate()) : tile.index;
                    const meta =
                        mode === 'daily'
                            ? formatDate(locale, day, { weekday: 'short', month: 'short' })
                            : t(`home.modes.${mode}.meta`);
                    return (
                        <button
                            key={mode}
                            ref={(element) => {
                                buttons.current[index] = element;
                            }}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            aria-labelledby={`${id}-name`}
                            aria-describedby={`${id}-meta ${id}-best`}
                            tabIndex={isSelected ? 0 : -1}
                            className={isSelected ? 'mode-card is-selected' : 'mode-card'}
                            data-suit={tile.suit}
                            onClick={() => {
                                select(mode);
                            }}
                            onKeyDown={(event) => {
                                onKeyDown(event, index);
                            }}
                        >
                            <span className="mode-card__corner" aria-hidden="true">
                                <b>{corner}</b>
                                <i>{tile.glyph}</i>
                            </span>
                            <span className="mode-card__pip" aria-hidden="true" data-glyph={tile.glyph} />
                            <span className="mode-card__name" id={`${id}-name`}>
                                {t(`home.modes.${mode}.name`)}
                            </span>
                            <span className="mode-card__meta" id={`${id}-meta`}>
                                {meta}
                            </span>
                            <span className="mode-card__best" id={`${id}-best`}>
                                {bestOf(mode)}
                            </span>
                        </button>
                    );
                })}
            </div>
        </>
    );
}
