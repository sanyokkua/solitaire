import { useTranslate } from '../../i18n/useTranslate';

export function BuildStamp() {
    const t = useTranslate();
    const rawValue = typeof __APP_BUILD_TIMESTAMP__ === 'string' ? __APP_BUILD_TIMESTAMP__ : t('build.dev');
    const label = t('build.label', { value: rawValue });

    return <footer aria-label={label}>{label}</footer>;
}
