import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { closeSheet } from '../../features/game/navigationThunks';
import { CATALOGS, SUPPORTED_LOCALES, type Locale } from '../../i18n/catalog';
import { resetAllLocalData, resetStatistics } from '../../features/persistence/resetThunks';
import {
    preferenceSet,
    selectPreferences,
    type CardBack,
    type TapMode,
    type Theme,
} from '../../features/preferences/preferencesSlice';
import { useTranslate } from '../../i18n/useTranslate';
import { ConfirmAction } from '../components/ConfirmAction';
import { Segmented } from '../components/Segmented';
import { SettingRow } from '../components/SettingRow';
import { Switch } from '../components/Switch';
import { Swatches } from '../components/Swatches';
import { ModalSheet } from './ModalSheet';

/**
 * Settings (D2, D13): Appearance and Play groups (5.1), Language and Data groups (5.2). Every control dispatches
 * `preferenceSet` straight away — no Save button — through the existing preferences slice and its persistence, and
 * the theme controller (`app/themeController.ts`) already reacts to every change made here. The Language group's
 * options come straight from the `CATALOGS` registry (`i18n/catalog.ts`), each labelled by its own name, so adding a
 * language needs no change here (LO "Adding a language needs one catalog and one registration"). Each Data action
 * goes through `ConfirmAction`, so nothing is cleared until it is explicitly confirmed.
 */
export function SettingsSheet() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const preferences = useAppSelector(selectPreferences);
    const themeFirstOptionRef = useRef<HTMLButtonElement>(null);

    return (
        <ModalSheet
            heading={t('settings.heading')}
            initialFocusRef={themeFirstOptionRef}
            onDismiss={() => {
                dispatch(closeSheet());
            }}
            returnFocusFallback={() => {
                dispatch(closeSheet());
            }}
        >
            <div className="sub-label">{t('settings.group.appearance')}</div>

            <SettingRow label={t('settings.theme.label')} description={t('settings.theme.description')}>
                <Segmented<Theme>
                    label={t('settings.theme.label')}
                    value={preferences.theme}
                    onChange={(value) => {
                        dispatch(preferenceSet({ key: 'theme', value }));
                    }}
                    firstOptionRef={themeFirstOptionRef}
                    options={[
                        { value: 'light', label: t('settings.theme.light') },
                        { value: 'dark', label: t('settings.theme.dark') },
                        { value: 'system', label: t('settings.theme.system') },
                    ]}
                />
            </SettingRow>

            <SettingRow
                label={t('settings.nightCards.label')}
                description={t('settings.nightCards.description')}
                inline
            >
                <Switch
                    label={t('settings.nightCards.label')}
                    checked={preferences.nightCards}
                    onChange={(value) => {
                        dispatch(preferenceSet({ key: 'nightCards', value }));
                    }}
                />
            </SettingRow>

            <SettingRow label={t('settings.fourColor.label')} description={t('settings.fourColor.description')} inline>
                <Switch
                    label={t('settings.fourColor.label')}
                    checked={preferences.fourColor}
                    onChange={(value) => {
                        dispatch(preferenceSet({ key: 'fourColor', value }));
                    }}
                />
            </SettingRow>

            <SettingRow label={t('settings.cardBack.label')}>
                <Swatches<CardBack>
                    label={t('settings.cardBack.label')}
                    value={preferences.cardBack}
                    onChange={(value) => {
                        dispatch(preferenceSet({ key: 'cardBack', value }));
                    }}
                    options={[
                        {
                            value: 'harbour',
                            name: t('settings.cardBack.harbour'),
                            primary: '#457b9d',
                            secondary: '#5a8fb0',
                        },
                        { value: 'navy', name: t('settings.cardBack.navy'), primary: '#13315c', secondary: '#1d3f70' },
                        { value: 'sky', name: t('settings.cardBack.sky'), primary: '#5bc0eb', secondary: '#7dcdef' },
                        {
                            value: 'coral',
                            name: t('settings.cardBack.coral'),
                            primary: '#d9555f',
                            secondary: '#e46e77',
                        },
                    ]}
                />
            </SettingRow>

            <div className="sub-label">{t('settings.group.play')}</div>

            <SettingRow label={t('settings.tapMode.label')} description={t('settings.tapMode.description')}>
                <Segmented<TapMode>
                    label={t('settings.tapMode.label')}
                    value={preferences.tapMode}
                    onChange={(value) => {
                        dispatch(preferenceSet({ key: 'tapMode', value }));
                    }}
                    options={[
                        { value: 'smart', label: t('settings.tapMode.smart') },
                        { value: 'select', label: t('settings.tapMode.select') },
                    ]}
                />
            </SettingRow>

            <SettingRow label={t('settings.highlight.label')} description={t('settings.highlight.description')} inline>
                <Switch
                    label={t('settings.highlight.label')}
                    checked={preferences.highlight}
                    onChange={(value) => {
                        dispatch(preferenceSet({ key: 'highlight', value }));
                    }}
                />
            </SettingRow>

            <SettingRow label={t('settings.autoSafe.label')} description={t('settings.autoSafe.description')} inline>
                <Switch
                    label={t('settings.autoSafe.label')}
                    checked={preferences.autoSafe}
                    onChange={(value) => {
                        dispatch(preferenceSet({ key: 'autoSafe', value }));
                    }}
                />
            </SettingRow>

            <SettingRow
                label={t('settings.stockRight.label')}
                description={t('settings.stockRight.description')}
                inline
            >
                <Switch
                    label={t('settings.stockRight.label')}
                    checked={preferences.stockRight}
                    onChange={(value) => {
                        dispatch(preferenceSet({ key: 'stockRight', value }));
                    }}
                />
            </SettingRow>

            <SettingRow
                label={t('settings.animations.label')}
                description={t('settings.animations.description')}
                inline
            >
                <Switch
                    label={t('settings.animations.label')}
                    checked={preferences.animations}
                    onChange={(value) => {
                        dispatch(preferenceSet({ key: 'animations', value }));
                    }}
                />
            </SettingRow>

            <div className="sub-label">{t('settings.group.language')}</div>

            <SettingRow label={t('settings.language.label')}>
                <Segmented<Locale>
                    label={t('settings.language.label')}
                    value={preferences.locale}
                    onChange={(value) => {
                        dispatch(preferenceSet({ key: 'locale', value }));
                    }}
                    options={SUPPORTED_LOCALES.map((locale) => ({ value: locale, label: CATALOGS[locale].name }))}
                />
            </SettingRow>

            <div className="sub-label">{t('settings.group.data')}</div>

            <SettingRow
                label={t('settings.resetStats.label')}
                description={t('settings.resetStats.description')}
                inline
            >
                <ConfirmAction
                    label={t('settings.resetStats.label')}
                    confirmLabel={t('confirmAction.confirm')}
                    cancelLabel={t('confirmAction.cancel')}
                    onConfirm={() => {
                        dispatch(resetStatistics());
                    }}
                />
            </SettingRow>

            <SettingRow label={t('settings.resetAll.label')} description={t('settings.resetAll.description')} inline>
                <ConfirmAction
                    label={t('settings.resetAll.label')}
                    confirmLabel={t('confirmAction.confirm')}
                    cancelLabel={t('confirmAction.cancel')}
                    onConfirm={() => {
                        dispatch(resetAllLocalData());
                    }}
                />
            </SettingRow>
        </ModalSheet>
    );
}
