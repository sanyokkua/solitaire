import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { preferenceSet, selectPreference } from '../../../features/preferences/preferencesSlice';
import { useTranslate } from '../../../i18n/useTranslate';
import { Switch } from '../../components/Switch';

/**
 * Home's "Winnable deals only" card (6.2, HO "Winnable deals only switch"). Only Draw 1 is solver-checked, so the switch
 * is live there and reads and writes `winnableOnly`. Draw 3 and Vegas show it off, Daily shows it on (Daily deals are
 * always winnable); in those modes it is disabled and the stored choice is never touched.
 */
export function WinnableToggle() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const mode = useAppSelector((state) => selectPreference(state, 'selectedMode'));
    const stored = useAppSelector((state) => selectPreference(state, 'winnableOnly'));

    const editable = mode === 'draw1';
    const checked = mode === 'daily' ? true : editable && stored;
    const caption = editable
        ? t('home.winnable.captionDraw1')
        : t(mode === 'daily' ? 'home.winnable.captionDaily' : 'home.winnable.captionSolver');

    return (
        <div className="toggle-card">
            <div className="toggle-card__copy">
                <strong aria-hidden="true">{t('home.winnable.label')}</strong>
                <span id="winnable-caption">{caption}</span>
            </div>
            <Switch
                label={t('home.winnable.label')}
                checked={checked}
                disabled={!editable}
                describedBy="winnable-caption"
                onChange={(value) => {
                    dispatch(preferenceSet({ key: 'winnableOnly', value }));
                }}
            />
        </div>
    );
}
