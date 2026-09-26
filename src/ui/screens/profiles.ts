/**
 * The media condition under which the Game screen uses the side-rails chrome profile (landscape and at most 720 px
 * tall); anywhere else it is stacked. `layout.css` repeats this condition literally in its rails `@media` rule, and
 * `tests/unit/ui/layoutCss.test.ts` fails if the two drift apart.
 */
export const RAILS_QUERY = '(orientation: landscape) and (max-height: 720px)';
