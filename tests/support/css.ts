/**
 * Shared, regex-based CSS reading for the static stylesheet tests (`tests/unit/ui/*Css.test.ts`,
 * `tests/unit/ui/tokens.test.ts`). Good enough for this codebase's hand-written, unminified CSS; not a real parser.
 */

/** `css` with every `/* ... *\/` comment removed, so a comment above a rule never leaks into its selector text. */
export function stripComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * The declaration body of the first rule whose selector list matches `selector`: an exact match (after splitting the
 * rule's selector list on `,` and trimming) for a string, or a regex test against the raw selector list for a RegExp.
 */
export function ruleBody(css: string, selector: string | RegExp): string {
    for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (selectors === undefined || body === undefined) continue;
        const matches =
            typeof selector === 'string'
                ? selectors
                      .split(',')
                      .map((s) => s.trim())
                      .includes(selector)
                : selector.test(selectors.trim());
        if (matches) return body;
    }
    throw new Error(`no rule matching ${String(selector)}`);
}

/** The declaration bodies of every rule in `css` whose selector list contains exactly `selector`. */
export function rulesFor(css: string, selector: string): string[] {
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selectors, body]) =>
        selectors !== undefined &&
        body !== undefined &&
        selectors
            .split(',')
            .map((s) => s.trim())
            .includes(selector)
            ? [body]
            : [],
    );
}

/** The text between the braces that follow the first `header` in `css`, nested braces included (e.g. an `@media` block). */
export function blockAfter(css: string, header: string): string {
    const start = css.indexOf(header);
    if (start === -1) throw new Error(`no "${header}" in the given CSS`);
    const open = css.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
        if (css[i] === '{') depth += 1;
        if (css[i] === '}') depth -= 1;
        if (depth === 0) return css.slice(open + 1, i);
    }
    throw new Error(`unclosed block after "${header}"`);
}

/** The custom-property names declared directly in `block`, sorted. */
export function declaredTokens(block: string): string[] {
    return [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].flatMap((match) => (match[1] ? [match[1]] : [])).sort();
}

/** The value of one custom property in `block`, or `undefined` when the block does not declare it. */
export function valueOf(block: string, token: string): string | undefined {
    const match = new RegExp(`${token}\\s*:\\s*([^;]+);`).exec(block);
    return match?.[1]?.trim();
}
