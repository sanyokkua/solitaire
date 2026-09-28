import type { ReactNode } from 'react';
import type { SheetId } from '../../app/appSlice';
import { useAppSelector } from '../../app/hooks';
import { selectSheet } from '../../app/selectors';
import { AboutSheet } from './AboutSheet';
import { DealCodeSheet } from './DealCodeSheet';
import { HelpSheet } from './HelpSheet';
import { NewDealSheet } from './NewDealSheet';
import { PausedSheet } from './PausedSheet';
import { SettingsSheet } from './SettingsSheet';
import { StatsSheet } from './StatsSheet';
import { WinSheet } from './WinSheet';

/**
 * One entry per sheet the player can open (D2): each renders its own `ModalSheet`. Section 5 fills this in one case
 * per task; the rest stay unregistered until their own task adds them.
 */
const SHEETS: Partial<Record<SheetId, () => ReactNode>> = {
    settings: SettingsSheet,
    help: HelpSheet,
    stats: StatsSheet,
    newDeal: NewDealSheet,
    paused: PausedSheet,
    win: WinSheet,
    dealCode: DealCodeSheet,
    about: AboutSheet,
};

/** Mounted once by `App` (D2): renders the open sheet, or nothing while `sheet` is `null`. */
export function SheetHost() {
    const sheet = useAppSelector(selectSheet);
    if (sheet === null) return null;

    const Sheet = SHEETS[sheet];
    return Sheet ? <Sheet /> : null;
}
