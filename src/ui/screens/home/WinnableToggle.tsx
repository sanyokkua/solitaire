import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { preferenceSet, selectPreference, type Difficulty } from '../../../features/preferences/preferencesSlice';
import type { MessageKey } from '../../../i18n/locales/en';
import { useTranslate } from '../../../i18n/useTranslate';
import { Segmented, type SegmentedOption } from '../../components/Segmented';
import { Switch } from '../../components/Switch';

const DIFFICULTY_OPTIONS: readonly { readonly value: Difficulty; readonly label: MessageKey }[] = [
    { value: 'any', label: 'home.difficulty.any' },
    { value: 'easy', label: 'grade.easy' },
    { value: 'medium', label: 'grade.medium' },
    { value: 'hard', label: 'grade.hard' },
];

/**
 * Home's "Winnable deals only" card (HO "Winnable deals only switch", D11). The switch is live in Draw 1, Draw 3 and
 * Vegas and reads and writes `winnableOnly`; in Daily it is disabled and reports on (Daily deals are always checked)
 * and the stored choice is never touched. Under the caption, the Difficulty group is enabled only while the switch is
 * on outside Daily; while disabled it still shows the stored choice and never writes it.
 */
export function WinnableToggle() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const mode = useAppSelector((state) => selectPreference(state, 'selectedMode'));
    const stored = useAppSelector((state) => selectPreference(state, 'winnableOnly'));
    const difficulty = useAppSelector((state) => selectPreference(state, 'difficulty'));

    const daily = mode === 'daily';
    const checked = daily || stored;
    const options: readonly SegmentedOption<Difficulty>[] = DIFFICULTY_OPTIONS.map(({ value, label }) => ({
        value,
        label: t(label),
    }));

    return (
        <div className="toggle-card">
            <div className="toggle-card__row">
                <div className="toggle-card__copy">
                    <strong aria-hidden="true">{t('home.winnable.label')}</strong>
                    <span id="winnable-caption">
                        {t(daily ? 'home.winnable.captionDaily' : 'home.winnable.caption')}
                    </span>
                </div>
                <Switch
                    label={t('home.winnable.label')}
                    checked={checked}
                    disabled={daily}
                    describedBy="winnable-caption"
                    onChange={(value) => {
                        dispatch(preferenceSet({ key: 'winnableOnly', value }));
                    }}
                />
            </div>
            <Segmented
                label={t('home.difficulty.label')}
                options={options}
                value={difficulty}
                disabled={daily || !stored}
                onChange={(value) => {
                    dispatch(preferenceSet({ key: 'difficulty', value }));
                }}
            />
        </div>
    );
}
