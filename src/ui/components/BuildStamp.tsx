import { useTranslate } from '../../i18n/useTranslate';

/** The running build: the CI run number and UTC build time (`__APP_BUILD__`, D13), or "Development build" without a number. */
export function BuildStamp() {
    const t = useTranslate();
    const { number, time } = __APP_BUILD__;
    const value = number ? t('build.number', { number, time }) : t('build.dev', { time });
    const label = t('build.label', { value });

    return <footer aria-label={label}>{label}</footer>;
}
