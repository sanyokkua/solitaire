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
 * The chrome reservation: what the real Game frame (`src/ui/screens/GameScreen.tsx` with `layout.css`) takes around the
 * board panel, measured in Chromium at the design's "Chrome reservation" viewports and rounded UP to whole pixels, so
 * the fixture is never more optimistic than the app. Each value is the maximum over its partition:
 * - stacked, 480 px wide or narrower, hint line shown: 360x650 and 466x678;
 * - stacked, 480 px wide or narrower, hint line hidden: 320x480 and 466x490;
 * - stacked, wider than 480 px: 616x686, 835x752 and 2560x1440; no matrix configuration is wide and hint-hidden, so
 *   that partition reuses the hint-shown values;
 * - side rails: 852x341 and 1280x720.
 * Each was measured with a fine pointer and with a coarse one (touch emulation), as the viewport minus the panel's
 * content box (the width first capped at 1024 px in the stacked profile). Coarse pointers make Back and the chip slot
 * 4 px taller, which is why their heights differ; the rails do not depend on the pointer. The device-fit e2e cases (6.1)
 * hold the app to these numbers, so a frame change that grows the chrome fails there and needs the values re-measured.
 */
export const CHROME_BUDGET = {
    stacked: {
        fine: {
            narrow: { hint: { width: 12, height: 241 }, noHint: { width: 12, height: 220 } },
            /** No matrix configuration is wide and hint-hidden, so that partition reuses the hint-shown budget. */
            wide: { hint: { width: 26, height: 284 }, noHint: { width: 26, height: 284 } },
        },
        coarse: {
            narrow: { hint: { width: 12, height: 245 }, noHint: { width: 12, height: 224 } },
            wide: { hint: { width: 26, height: 288 }, noHint: { width: 26, height: 288 } },
        },
    },
    rails: { fine: { width: 185, height: 15 }, coarse: { width: 185, height: 15 } },
} as const;

/** Widest the stacked frame grows, in px (64 rem). */
const STACKED_FRAME_MAX = 1024;
/** Widest a viewport is treated as narrow, in px. */
const NARROW_MAX = 480;
/** Tallest a landscape viewport is that still uses the side rails, in px. */
export const RAILS_MAX_HEIGHT = 720;
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
