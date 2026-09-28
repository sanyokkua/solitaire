import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { installApp } from '../../../app/pwaThunks';
import { openSheet } from '../../../features/game/navigationThunks';
import { useTranslate } from '../../../i18n/useTranslate';

const LINKS = [
    ['home.links.stats', 'stats'],
    ['home.links.settings', 'settings'],
    ['home.links.dealCode', 'dealCode'],
    ['home.links.about', 'about'],
] as const;

/** Home's footer links (mockup `.footlinks`, HO "Home links"): each button opens its sheet. */
export function HomeLinks() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const installable = useAppSelector(({ app }) => app.installable);

    return (
        <nav className="footlinks" aria-label={t('home.links.label')}>
            {LINKS.map(([key, sheet]) => (
                <button
                    key={sheet}
                    type="button"
                    onClick={() => {
                        dispatch(openSheet(sheet));
                    }}
                >
                    {t(key)}
                </button>
            ))}
            {installable && (
                <button
                    type="button"
                    onClick={() => {
                        void dispatch(installApp());
                    }}
                >
                    {t('home.links.install')}
                </button>
            )}
        </nav>
    );
}
