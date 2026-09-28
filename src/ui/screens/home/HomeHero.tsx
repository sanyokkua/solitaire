import { useTranslate } from '../../../i18n/useTranslate';
import { CardView } from '../../board/CardView';

/** The fan's cards, left to right: A♠, A♦, A♣, A♥, K♠ (ids from `domain/cards`); `home.css` spreads them by position. */
const FAN_CARDS = [39, 13, 26, 0, 51] as const;

/** Home's hero panel: badge, the SOLITAIRE wordmark (the screen heading), pitch, the floating card fan and the dither. */
export function HomeHero() {
    const t = useTranslate();

    return (
        <div className="home-hero">
            <div className="home-hero__copy">
                <span className="badge">
                    <span className="live-dot" aria-hidden="true" />
                    {t('home.hero.badge')}
                </span>
                <h1 className="wordmark" tabIndex={-1}>
                    {t('app.title')}
                </h1>
                <p>{t('home.hero.pitch')}</p>
            </div>
            <div className="home-hero__art" aria-hidden="true">
                <div className="hero-fan">
                    {FAN_CARDS.map((id, index) => (
                        <CardView
                            key={id}
                            id={id}
                            x={0}
                            y={0}
                            z={index}
                            pile="hero"
                            index={index}
                            faceUp
                            buried={false}
                            compact={false}
                            movable={false}
                        />
                    ))}
                </div>
            </div>
            <div className="dither" aria-hidden="true" />
        </div>
    );
}
