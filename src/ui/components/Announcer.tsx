import { useState } from 'react';
import { useAppSelector } from '../../app/hooks';
import { selectAnnouncement } from '../../features/interaction/selectors';
import { formatAnnouncement } from '../announce';

/** Appended to alternate identical messages: invisible, but it changes the text so the region is read again. */
const ZERO_WIDTH = '\u200B';

interface Spoken {
    /** The batch counter last seen. */
    readonly seq: number;
    /** The running number of the last announcement spoken; later ones are new. */
    readonly lastN: number;
    /** The words of the last batch, without the marker. */
    readonly words: string;
    /** Whether the marker is on, so a repeated message differs from the one before it. */
    readonly marked: boolean;
}

/**
 * The one polite live region (KS-A11Y-02): visually hidden, it speaks each announcement in the log that it has not
 * spoken yet, once per batch. Its text comes from the log alone, so a clock tick or any other render leaves it as it
 * was; a remount starts after the last announcement so a return to the game does not replay old ones. The words are
 * one string child, so the same text node's data changes (a screen reader ignores a node being removed) and a repeated
 * message alternates with the zero-width marker.
 */
export function Announcer() {
    const log = useAppSelector(selectAnnouncement);
    const [spoken, setSpoken] = useState<Spoken>(() => ({
        seq: log.seq,
        lastN: log.items.at(-1)?.n ?? 0,
        words: '',
        marked: false,
    }));

    let current = spoken;
    if (log.seq !== spoken.seq) {
        const fresh = log.items.filter(({ n }) => n > spoken.lastN);
        const words = fresh.length === 0 ? spoken.words : fresh.map(({ item }) => formatAnnouncement(item)).join(' ');
        current = {
            seq: log.seq,
            lastN: log.items.at(-1)?.n ?? spoken.lastN,
            words,
            marked: words === spoken.words && !spoken.marked,
        };
        setSpoken(current);
    }

    return (
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {current.marked ? current.words + ZERO_WIDTH : current.words}
        </div>
    );
}
