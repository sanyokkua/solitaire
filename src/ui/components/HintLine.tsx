import { useAppSelector } from '../../app/hooks';
import { selectHint } from '../../features/interaction/selectors';
import { selectPreference } from '../../features/preferences/preferencesSlice';
import { useTranslate } from '../../i18n/useTranslate';
import { hintText } from '../announce';
import { useMediaQuery } from '../useMediaQuery';

/**
 * The Game screen's hint line, one decorative line in the reserved `.game-hint` box (`aria-hidden`: the announcer
 * speaks hints). While a hint is showing it reads `hintText`; otherwise it describes the current tap setting, followed
 * by the Space / Ctrl+Z / H key chips where the pointer is fine (CSS also hides the chips at 460 px wide or narrower).
 */
export function HintLine() {
    const t = useTranslate();
    const hint = useAppSelector(selectHint);
    const tapMode = useAppSelector((state) => selectPreference(state, 'tapMode'));
    const finePointer = useMediaQuery('(pointer: fine)');

    return (
        <p className="game-hint" aria-hidden="true">
            <span className="hint-text">{hint === null ? t(`game.hintLine.${tapMode}`) : hintText(t, hint)}</span>
            {hint === null && finePointer && (
                <span className="hint-keys">
                    <kbd>{t('help.key.space')}</kbd>
                    <kbd>Ctrl+Z</kbd>
                    <kbd>H</kbd>
                </span>
            )}
        </p>
    );
}
