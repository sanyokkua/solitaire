import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { preferenceSet, selectPreference } from '../../features/preferences/preferencesSlice';
import { useTranslate } from '../../i18n/useTranslate';
import { useMediaQuery } from '../useMediaQuery';
import { Icon } from './Icon';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const MOON = 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z';
const SUN =
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4';

/**
 * Switches between the light and dark themes. The icon and the name show the target theme (a moon offers dark, a sun
 * offers light). From System it switches to the opposite of the scheme currently shown, and it always stores a
 * concrete `light` or `dark`, never `system`; the theme controller applies the change at once.
 */
export function ThemeToggle() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const theme = useAppSelector((state) => selectPreference(state, 'theme'));
    const deviceDark = useMediaQuery(DARK_QUERY);
    const showingDark = theme === 'system' ? deviceDark : theme === 'dark';

    return (
        <button
            type="button"
            className="icon-action"
            aria-label={t(showingDark ? 'home.theme.switchToLight' : 'home.theme.switchToDark')}
            onClick={() => {
                dispatch(preferenceSet({ key: 'theme', value: showingDark ? 'light' : 'dark' }));
            }}
        >
            <Icon path={showingDark ? SUN : MOON} />
        </button>
    );
}
