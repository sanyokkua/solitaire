// covers: KS-I18N-01, KS-I18N-03
import type { MessageKey } from '../../../src/i18n/locales/en';
import type { Message } from '../../../src/i18n/translate';

/**
 * Type-only proof that `Record<MessageKey, Message>` rejects a catalog missing a key: this is what makes a real
 * `locales/uk.ts` missing an English key fail `typecheck` (LO "Every language provides every message"). This file is
 * excluded from `vitest`'s `*.{test,spec}.ts` glob and runs only through `tsc -b`.
 */
declare function acceptsCompleteCatalog(catalog: Record<MessageKey, Message>): void;

// @ts-expect-error -- an empty object is missing every MessageKey, so it is not a valid Record<MessageKey, Message>.
acceptsCompleteCatalog({});
