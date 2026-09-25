/**
 * The device matrix of the table layout: the 13 screens of research R§13.1, their 52 board configurations, three
 * baselines, and the board size each one leaves once the app frame takes its share. It imports nothing from
 * `vitest`, so the unit sweep and the e2e device-fit matrix share it.
 */

/** The primary pointer of a screen. */
export type Pointer = 'coarse' | 'fine';
/** Which browser bars a device's browser mode subtracts from the height. */
export type Platform = 'ios' | 'android';
/** How the app runs: in the browser (bars subtracted from the height) or installed (the full screen). */
export type Mode = 'browser' | 'installed';
/** The way the device is held. */
export type Orientation = 'portrait' | 'landscape';

/** What the frame needs to know about a screen. */
export interface ScreenSpec {
    /** CSS viewport width in px. */
    readonly width: number;
    /** CSS viewport height in px. */
    readonly height: number;
    readonly pointer: Pointer;
}

/** One screen of R§13.1, in portrait. */
export interface Viewport {
    readonly name: string;
    readonly platform: Platform;
    /** Portrait width in px: the shorter side. */
    readonly width: number;
    /** Portrait height in px: the longer side. */
    readonly height: number;
}

/** One viewport in one orientation and mode; always a touch screen. */
export interface DeviceConfig extends ScreenSpec {
    /** The viewport's name. */
    readonly name: string;
    /** Name, orientation and mode, unique across the 52 configurations. */
    readonly label: string;
    readonly platform: Platform;
    readonly orientation: Orientation;
    readonly mode: Mode;
}

/** A reference size outside the device matrix. */
export interface Baseline extends ScreenSpec {
    readonly label: string;
}

/** A row of R§13.1 as listed, in whichever orientation the table gives. */
interface ListedViewport {
    readonly name: string;
    readonly platform: Platform;
    readonly width: number;
    readonly height: number;
}

/** The 12 rows of R§13.1, with the Galaxy S25+ / S25 Ultra row counted at both of its viewports. */
const LISTED_VIEWPORTS: readonly ListedViewport[] = [
    { name: 'iPhone 14 Pro', platform: 'ios', width: 393, height: 852 },
    { name: 'iPhone 14 Pro Max', platform: 'ios', width: 430, height: 932 },
    { name: 'iPhone 17 Pro', platform: 'ios', width: 402, height: 874 },
    { name: 'iPhone 17 Pro Max', platform: 'ios', width: 440, height: 956 },
    { name: 'Galaxy S25', platform: 'android', width: 360, height: 780 },
    { name: 'Galaxy S25+ / S25 Ultra, FHD+', platform: 'android', width: 384, height: 832 },
    { name: 'Galaxy S25+ / S25 Ultra, QHD+', platform: 'android', width: 412, height: 891 },
    { name: 'iPhone Duo, outer', platform: 'ios', width: 466, height: 678 },
    { name: 'iPhone Duo, inner', platform: 'ios', width: 890, height: 626 },
    { name: 'Galaxy Z Fold 8, cover', platform: 'android', width: 416, height: 657 },
    { name: 'Galaxy Z Fold 8, main', platform: 'android', width: 816, height: 616 },
    { name: 'Galaxy Z Fold 8 Ultra, cover', platform: 'android', width: 360, height: 840 },
    { name: 'Galaxy Z Fold 8 Ultra, main', platform: 'android', width: 835, height: 752 },
];

/** The 13 viewports, each normalised to portrait: `(min(w, h), max(w, h))`. */
export const VIEWPORTS: readonly Viewport[] = LISTED_VIEWPORTS.map(({ name, platform, width, height }) => ({
    name,
    platform,
    width: Math.min(width, height),
    height: Math.max(width, height),
}));

/** Height the browser's own bars take, in px, by platform and orientation (R§13.1). */
const BROWSER_BARS: Readonly<Record<Platform, Readonly<Record<Orientation, number>>>> = {
    ios: { portrait: 188, landscape: 52 },
    android: { portrait: 130, landscape: 80 },
};

/** The configuration of a viewport in one orientation and mode. */
function configOf(viewport: Viewport, orientation: Orientation, mode: Mode): DeviceConfig {
    const portrait = orientation === 'portrait';
    const width = portrait ? viewport.width : viewport.height;
    const fullHeight = portrait ? viewport.height : viewport.width;
    return {
        name: viewport.name,
        label: `${viewport.name} ${orientation} ${mode}`,
        platform: viewport.platform,
        orientation,
        mode,
        width,
        height: mode === 'browser' ? fullHeight - BROWSER_BARS[viewport.platform][orientation] : fullHeight,
        pointer: 'coarse',
    };
}

/** The 52 configurations: 13 viewports x portrait and landscape x browser and installed, all coarse. */
export const DEVICE_CONFIGS: readonly DeviceConfig[] = VIEWPORTS.flatMap((viewport) =>
    (['portrait', 'landscape'] as const).flatMap((orientation) =>
        (['browser', 'installed'] as const).map((mode) => configOf(viewport, orientation, mode)),
    ),
);

/** The three baselines: the smallest supported screen, a desktop window and a large desktop window. */
export const BASELINES: readonly Baseline[] = [
    { label: '320x480 coarse', width: 320, height: 480, pointer: 'coarse' },
    { label: '1280x720 fine', width: 1280, height: 720, pointer: 'fine' },
    { label: '2560x1440 fine', width: 2560, height: 1440, pointer: 'fine' },
];

/** What the app frame takes around the board panel, in px. */
export interface ChromeBudget {
    readonly width: number;
    readonly height: number;
}

/**
 * The chrome reservation. This is a SEED computed from the mockup frame CSS (`docs/spec/mockup/klondike-mockup.html`
 * L172-198, L307-318 and L377-415); task 4.3 replaces it with values measured from the real frame, and the e2e
 * device-fit cases (6.1) then hold the app to it. Each value is the maximum over its partition, so the fixture is never
 * more optimistic than the frame.
 *
 * Units: 1 rem = 16 px. Text lines are 1.25 times the font size (the mockup sets no line-height, and the pixel font falls
 * back to a monospace face), which rounds every "normal" line height up.
 *
 * Stacked profile, top to bottom (`.screen` column; the board panel is `flex: 1` and its 1 px border is part of the
 * budget because the board fills the padding box):
 * - top bar: 0.7 rem padding x2 + 1 px bottom border + the icon button (2.5 rem fine, 2.75 rem coarse);
 * - `.game-body` padding: 0.65 rem top and 0.4 rem bottom above 480 px, 0.4 rem and 0.3 rem at or below;
 * - HUD: 0.6 rem padding x2 + 2 px border + the tallest child, the "New deal" face (2.9 rem button + 0.15 rem gap + one
 *   0.52 rem label line), which the 460 px rule only shrinks below 461 px, so 461-480 px sets the maximum;
 * - hint line, when shown (hidden in portrait at 600 px tall or less): one 0.7 rem line above 480 px, else 0.64 rem lines.
 *   The keyboard chips (0.5 rem, 0.2 rem padding x2, 1 px border x2) show only with a fine pointer and wrap under the
 *   text when the row is narrow, so a fine pointer reserves text + 0.35 rem row gap + chip row (up to 461 px hides them,
 *   461-480 px still shows them), while a coarse pointer above 480 px takes one text line and at or below 480 px two;
 * - toolbar: 0.35 rem padding x2 + 2 px border + the 3 rem tool;
 * - the flex gaps between the visible children (0.6 rem above 480 px, 0.4 rem at or below);
 * - footer stamp, above 480 px only: (0.5 + 0.6) rem padding + one 0.5 rem line.
 * Width: `.game-body` padding-inline (0.75 rem x2 above 480 px, 0.3 rem x2 at or below) + the panel's 2 px border; the
 * frame is capped at 64 rem (1024 px) wide.
 *
 * Side rails (landscape and 720 px tall or less): the top bar, hint line and footer are gone. Height is 0.4 rem padding x2
 * + the panel border; the rails stretch to the board's height and scroll inside it. Width is 0.4 rem padding x2, the HUD
 * rail 5.4 rem, the toolbar rail 4.4 rem, two 0.4 rem gaps and the panel border. Nothing in the rails depends on the
 * pointer, so both pointers take the same values.
 */
const REM = 16;
const LINE = 1.25;
const PANEL_BORDER = 2;

const TOPBAR = (icon: number): number => 0.7 * REM * 2 + 1 + icon * REM;
const HUD = 0.6 * REM * 2 + 2 + (2.9 + 0.15 + 0.52 * LINE) * REM;
const TOOLBAR = 0.35 * REM * 2 + 2 + 3 * REM;
const FOOTER = (0.5 + 0.6) * REM + 0.5 * LINE * REM;
const CHIP_ROW = (0.5 * LINE + 0.4) * REM + 2;
const ROW_GAP = 0.35 * REM;

/** The stacked height budget from its parts. */
function stackedHeight(options: {
    readonly topbar: number;
    readonly padding: number;
    readonly hint: number;
    readonly gap: number;
    readonly footer: number;
}): number {
    const children = 3 + (options.hint > 0 ? 1 : 0);
    return (
        options.topbar +
        options.padding +
        HUD +
        options.hint +
        TOOLBAR +
        (children - 1) * options.gap +
        PANEL_BORDER +
        options.footer
    );
}

/** The stacked budget of one partition. */
function stacked(narrow: boolean, pointer: Pointer, hint: boolean): ChromeBudget {
    const fine = pointer === 'fine';
    const hintHeight = ((): number => {
        if (!hint) return 0;
        if (narrow) return fine ? 0.64 * LINE * REM + ROW_GAP + CHIP_ROW : 2 * 0.64 * LINE * REM;
        return fine ? 0.7 * LINE * REM + ROW_GAP + CHIP_ROW : 0.7 * LINE * REM;
    })();
    return {
        width: (narrow ? 0.3 : 0.75) * REM * 2 + PANEL_BORDER,
        height: stackedHeight({
            topbar: TOPBAR(fine ? 2.5 : 2.75),
            padding: (narrow ? 0.4 + 0.3 : 0.65 + 0.4) * REM,
            hint: hintHeight,
            gap: (narrow ? 0.4 : 0.6) * REM,
            footer: narrow ? 0 : FOOTER,
        }),
    };
}

/** The rails budget; identical for both pointers. */
const RAILS: ChromeBudget = {
    width: 0.4 * REM * 2 + 5.4 * REM + 4.4 * REM + 2 * 0.4 * REM + PANEL_BORDER,
    height: 0.4 * REM * 2 + PANEL_BORDER,
};

/** The chrome budget by profile, pointer, breakpoint and whether the hint line shows. */
export const CHROME_BUDGET = {
    stacked: {
        fine: {
            narrow: { hint: stacked(true, 'fine', true), noHint: stacked(true, 'fine', false) },
            /** No matrix configuration is wide and hint-hidden, so that partition reuses the hint-shown budget. */
            wide: { hint: stacked(false, 'fine', true), noHint: stacked(false, 'fine', true) },
        },
        coarse: {
            narrow: { hint: stacked(true, 'coarse', true), noHint: stacked(true, 'coarse', false) },
            wide: { hint: stacked(false, 'coarse', true), noHint: stacked(false, 'coarse', true) },
        },
    },
    rails: { fine: RAILS, coarse: RAILS },
} as const;

/** Widest the stacked frame grows, in px (64 rem). */
const STACKED_FRAME_MAX = 1024;
/** Widest a viewport is treated as narrow, in px. */
const NARROW_MAX = 480;
/** Tallest a landscape viewport is that still uses the side rails, in px. */
const RAILS_MAX_HEIGHT = 720;
/** Tallest a portrait viewport is that hides the hint line, in px. */
const HINT_HIDDEN_MAX_HEIGHT = 600;

/** Whether the frame uses the side rails for a viewport. */
function usesRails(screen: ScreenSpec): boolean {
    return screen.width > screen.height && screen.height <= RAILS_MAX_HEIGHT;
}

/** The chrome budget that applies to a screen when it is used with `pointer`. */
export function chromeBudgetFor(screen: ScreenSpec, pointer: Pointer = screen.pointer): ChromeBudget {
    if (usesRails(screen)) {
        return CHROME_BUDGET.rails[pointer];
    }
    const breakpoint = screen.width <= NARROW_MAX ? 'narrow' : 'wide';
    const hidden = screen.height >= screen.width && screen.height <= HINT_HIDDEN_MAX_HEIGHT;
    return CHROME_BUDGET.stacked[pointer][breakpoint][hidden ? 'noHint' : 'hint'];
}

/**
 * The board's inner size for a screen: the viewport minus the matching chrome budget. The stacked frame's width is
 * first capped at 1024 px; the rails have no cap. `pointer` overrides the screen's own pointer, which lets the sweep
 * try both pointer types on one screen; the budget of the pointer under test is then the one used.
 */
export function boardSizeFor(
    screen: ScreenSpec,
    pointer: Pointer = screen.pointer,
): { readonly width: number; readonly height: number } {
    const budget = chromeBudgetFor(screen, pointer);
    const frameWidth = usesRails(screen) ? screen.width : Math.min(screen.width, STACKED_FRAME_MAX);
    return { width: frameWidth - budget.width, height: screen.height - budget.height };
}
