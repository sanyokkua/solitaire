import { en } from '../../src/i18n/locales/en';
import type { Catalog, Message, PluralMessage } from '../../src/i18n/translate';

/** The code the pseudo catalog is registered under in tests. It is a well-formed language tag, so `Intl` accepts it. */
export const PSEUDO_LOCALE = 'pseudo';

/** How much longer than its English source every pseudo message is (German and Ukrainian run about this much longer). */
export const PSEUDO_GROWTH = 1.3;

const ACCENTS: Readonly<Record<string, string>> = {
    a: 'á',
    e: 'é',
    i: 'í',
    o: 'ó',
    u: 'ú',
    y: 'ý',
    A: 'Á',
    E: 'É',
    I: 'Í',
    O: 'Ó',
    U: 'Ú',
    Y: 'Ý',
};

/** Accents the vowels of a placeholder-free run of text. */
function accent(text: string): string {
    return text.replace(/[aeiouyAEIOUY]/g, (letter) => ACCENTS[letter] ?? letter);
}

/**
 * Turns one message into its pseudo form: vowels accented, `{placeholders}` untouched, grown by 30 % of the source
 * length with filler, and wrapped in brackets, so `Undo` becomes `[Úndó·]`. Any text on screen that is not bracketed
 * did not come through the catalog.
 */
export function pseudoText(text: string): string {
    const body = text
        .split(/(\{\w+\})/)
        .map((part) => (/^\{\w+\}$/.test(part) ? part : accent(part)))
        .join('');
    const extra = Math.max(1, Math.ceil(text.length * (PSEUDO_GROWTH - 1)));
    // Dots with a space every seventh character, so a long message can still wrap; the last character is a dot.
    const filler = Array.from({ length: extra }, (_, i) => (i % 7 === 6 && i < extra - 1 ? ' ' : '·')).join('');
    return `[${body}${filler}]`;
}

/** Applies {@link pseudoText} to every category of a message, keeping the plural shape. */
function pseudoMessage(message: Message): Message {
    if (typeof message === 'string') return pseudoText(message);
    const plural: PluralMessage = Object.fromEntries(
        Object.entries(message).map(([category, text]) => [category, pseudoText(text)]),
    );
    return plural;
}

/** A catalog with the same keys and shapes as `source` (English by default) and every message pseudo-localised. */
export function buildPseudoCatalog(source: Catalog = en): Catalog {
    return Object.fromEntries(Object.entries(source).map(([key, message]) => [key, pseudoMessage(message)]));
}

/**
 * Whether a piece of text on screen is acceptable in a pseudo-localised page: pseudo text (bracketed), or text that
 * is language-neutral: it has no letters at all (numbers, `2:05`, `$47`, symbols), or is the product name.
 */
export function isPseudoOrNeutral(text: string, neutral: readonly string[] = ['Solitaire']): boolean {
    const trimmed = text.trim();
    if (trimmed === '') return true;
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) return true;
    if (!/\p{L}/u.test(trimmed)) return true;
    return neutral.includes(trimmed);
}
