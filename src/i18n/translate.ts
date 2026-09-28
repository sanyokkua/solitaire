/** The plural categories CLDR defines; a language uses only some of them. */
export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** A counted message: one text per plural category this language needs. */
export type PluralMessage = Partial<Record<PluralCategory, string>>;

/** A catalog message: a plain string with `{name}` placeholders, or a plural message. */
export type Message = string | PluralMessage;

/** A flat, dotted-key catalog of messages. */
export type Catalog = Readonly<Record<string, Message>>;

/** Named values substituted into `{name}` placeholders; `count` also selects the plural form. */
export type TranslateParams = Readonly<Record<string, string | number>>;

/** Looks up and formats one message by key. */
export type Translate = (key: string, params?: TranslateParams) => string;

const pluralRulesCache = new Map<string, Intl.PluralRules>();

function pluralRulesFor(locale: string): Intl.PluralRules {
    let rules = pluralRulesCache.get(locale);
    if (rules === undefined) {
        rules = new Intl.PluralRules(locale);
        pluralRulesCache.set(locale, rules);
    }
    return rules;
}

function countOf(params: TranslateParams | undefined): number | undefined {
    const count = params?.count;
    return typeof count === 'number' ? count : undefined;
}

function selectPlural(message: PluralMessage, rules: Intl.PluralRules, count: number | undefined): string | undefined {
    const category = count === undefined ? 'other' : rules.select(count);
    return message[category] ?? message.other;
}

function fillParams(text: string, params: TranslateParams | undefined): string {
    if (params === undefined) return text;
    return text.replace(/\{(\w+)\}/g, (match: string, name: string) => {
        const value = params[name];
        return value === undefined ? match : String(value);
    });
}

/**
 * Builds a translator for `locale`, reading `catalog` first and `fallback` (the English catalog in production) for a
 * key `catalog` does not have. `t(key, params)` selects the plural form from `params.count` with a cached
 * `Intl.PluralRules(locale)`, then fills `{name}` placeholders from `params`. A key present in neither catalog is
 * returned unchanged, as a last resort that never throws.
 */
export function createTranslator(locale: string, catalog: Catalog, fallback: Catalog): Translate {
    const rules = pluralRulesFor(locale);
    return (key, params) => {
        const message = catalog[key] ?? fallback[key];
        if (message === undefined) return key;
        const count = countOf(params);
        const text = typeof message === 'string' ? message : (selectPlural(message, rules, count) ?? key);
        return fillParams(text, params);
    };
}

/** A UTC calendar date in `locale`'s words (the Daily chip and tile: every player sees the same day). */
export function formatDate(locale: string, date: Date, options: Intl.DateTimeFormatOptions = {}): string {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', ...options, timeZone: 'UTC' }).format(date);
}
