import { describe, expect, it } from 'vitest';
import { blockAfter, declaredTokens, ruleBody, rulesFor, stripComments, valueOf } from '../../support/css';

const SAMPLE = `
/* a comment naming .fake-selector, which must never be read as a rule */
.a, .b {
    color: red;
    --token-one: 1px;
}

.a {
    color: blue;
}

@media (min-width: 700px) {
    .a {
        color: green;
    }
    .nested {
        --token-two: 2px;
    }
}
`;

const CSS = stripComments(SAMPLE);

describe('stripComments', () => {
    it('removes block comments without touching real rules', () => {
        const stripped = stripComments(SAMPLE);
        expect(stripped).not.toContain('/*');
        expect(stripped).toContain('.a, .b {');
    });
});

describe('ruleBody', () => {
    it('finds a rule by an exact selector-list match', () => {
        expect(ruleBody(CSS, '.a')).toContain('--token-one: 1px;');
    });

    it('finds the first rule whose raw selector list matches a RegExp', () => {
        expect(ruleBody(CSS, /^\.a$/)).toContain('color: blue;');
    });

    it('throws when nothing matches', () => {
        expect(() => ruleBody(CSS, '.missing')).toThrow(/no rule matching/);
    });
});

describe('rulesFor', () => {
    it('returns every rule body whose selector list contains exactly the given selector, nested rules included', () => {
        const bodies = rulesFor(CSS, '.a');
        expect(bodies).toHaveLength(3);
        expect(bodies[0]).toContain('--token-one');
        expect(bodies[1]).toContain('color: blue;');
        expect(bodies[2]).toContain('color: green;');
    });

    it('returns an empty array when nothing matches', () => {
        expect(rulesFor(CSS, '.missing')).toEqual([]);
    });
});

describe('blockAfter', () => {
    it('returns the full, brace-depth-aware body of a nested @media block', () => {
        const media = blockAfter(CSS, '@media (min-width: 700px)');
        expect(media).toContain('.a {');
        expect(media).toContain('color: green;');
        expect(media).toContain('--token-two: 2px;');
    });

    it('throws when the header is absent', () => {
        expect(() => blockAfter(CSS, '@media print')).toThrow(/no "@media print"/);
    });
});

describe('declaredTokens and valueOf', () => {
    const block = ruleBody(CSS, '.a');

    it('lists the custom-property names declared in a block, sorted', () => {
        expect(declaredTokens(block)).toEqual(['--token-one']);
    });

    it('reads a single custom-property value', () => {
        expect(valueOf(block, '--token-one')).toBe('1px');
    });

    it('returns undefined for a token the block does not declare', () => {
        expect(valueOf(block, '--token-two')).toBeUndefined();
    });
});
