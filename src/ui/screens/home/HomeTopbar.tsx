import { useTranslate } from '../../../i18n/useTranslate';
import { SettingsButton } from '../../components/SettingsButton';
import { ThemeToggle } from '../../components/ThemeToggle';

/** Home's top bar: the pixel logo mark and title, the theme toggle and the Settings button. */
export function HomeTopbar() {
    const t = useTranslate();

    return (
        <header className="topbar">
            <span className="topbar__title">
                <span className="pixel-dot" aria-hidden="true" />
                {t('app.title')}
            </span>
            <span className="topbar__spacer" />
            <ThemeToggle />
            <SettingsButton />
        </header>
    );
}
