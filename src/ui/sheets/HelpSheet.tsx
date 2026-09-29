import { useRef } from 'react';
import { useAppDispatch } from '../../app/hooks';
import { closeSheet } from '../../features/game/navigationThunks';
import { useTranslate } from '../../i18n/useTranslate';
import { ModalSheet } from './ModalSheet';

interface Rule {
    readonly icon: string;
    readonly titleKey:
        | 'help.rule.foundations.title'
        | 'help.rule.alternating.title'
        | 'help.rule.kings.title'
        | 'help.rule.draw.title';
    readonly descriptionKey:
        | 'help.rule.foundations.description'
        | 'help.rule.alternating.description'
        | 'help.rule.kings.description'
        | 'help.rule.draw.description';
}

const GRADES = [
    { nameKey: 'grade.easy', descriptionKey: 'help.winnable.easy' },
    { nameKey: 'grade.medium', descriptionKey: 'help.winnable.medium' },
    { nameKey: 'grade.hard', descriptionKey: 'help.winnable.hard' },
] as const;

const RULES: readonly Rule[] = [
    { icon: 'A→K', titleKey: 'help.rule.foundations.title', descriptionKey: 'help.rule.foundations.description' },
    { icon: 'R/B', titleKey: 'help.rule.alternating.title', descriptionKey: 'help.rule.alternating.description' },
    { icon: 'K', titleKey: 'help.rule.kings.title', descriptionKey: 'help.rule.kings.description' },
    { icon: '1|3', titleKey: 'help.rule.draw.title', descriptionKey: 'help.rule.draw.description' },
];

/**
 * How to play (5.3, D2, D13): a static reference sheet, registered in `SheetHost` as `help`. Four `.help-rule` cards
 * (SH "How to play sheet") cover the win condition, the alternating-colour build rule, the empty-column rule and
 * Draw 1 vs Draw 3, followed by a `.keys-table` of every documented shortcut (KS-INP-08) with key names marked up as
 * `<kbd>` so assistive technology reads them in full, a short Standard/Vegas scoring summary, and a Winnable deals passage that explains the solver's proof and the
 * Easy/Medium/Hard grades (10.4). The sole action,
 * "Got it", both closes the sheet (`closeSheet()`, same as `onDismiss`) and is the initial-focus target (I5): this is
 * a reference sheet with nothing to change, so focus lands on the one way out rather than on a control that edits
 * anything.
 */
export function HelpSheet() {
    const t = useTranslate();
    const dispatch = useAppDispatch();
    const gotItRef = useRef<HTMLButtonElement>(null);

    function dismiss(): void {
        dispatch(closeSheet());
    }

    return (
        <ModalSheet heading={t('help.heading')} initialFocusRef={gotItRef} onDismiss={dismiss}>
            {RULES.map((rule) => (
                <div className="help-rule" key={rule.titleKey}>
                    <div className="help-rule__icon" aria-hidden="true">
                        {rule.icon}
                    </div>
                    <div>
                        <strong>{t(rule.titleKey)}</strong>
                        <p>{t(rule.descriptionKey)}</p>
                    </div>
                </div>
            ))}

            <div className="sub-label">{t('help.controls.heading')}</div>
            <table className="keys-table">
                <tbody>
                    <tr>
                        <td>
                            <kbd>{t('help.key.tap')}</kbd> / <kbd>{t('help.key.click')}</kbd>
                        </td>
                        <td>{t('help.controls.tapClick')}</td>
                    </tr>
                    <tr>
                        <td>
                            <kbd>{t('help.key.drag')}</kbd>
                        </td>
                        <td>{t('help.controls.drag')}</td>
                    </tr>
                    <tr>
                        <td>
                            <kbd>{t('help.key.doubleClick')}</kbd>
                        </td>
                        <td>{t('help.controls.doubleClick')}</td>
                    </tr>
                    <tr>
                        <td>
                            <kbd>{t('help.key.space')}</kbd>
                        </td>
                        <td>{t('help.controls.space')}</td>
                    </tr>
                    <tr>
                        <td>
                            <kbd>Ctrl+Z</kbd> <kbd>Ctrl+Y</kbd>
                        </td>
                        <td>{t('help.controls.undoRedo')}</td>
                    </tr>
                    <tr>
                        <td>
                            <kbd>H</kbd>
                        </td>
                        <td>{t('help.controls.hint')}</td>
                    </tr>
                    <tr>
                        <td>
                            <kbd>A</kbd>
                        </td>
                        <td>{t('help.controls.finish')}</td>
                    </tr>
                    <tr>
                        <td>
                            <kbd>N</kbd>
                        </td>
                        <td>{t('help.controls.newDeal')}</td>
                    </tr>
                    <tr>
                        <td>
                            <kbd>P</kbd>
                        </td>
                        <td>{t('help.controls.pause')}</td>
                    </tr>
                    <tr>
                        <td>
                            <kbd>Esc</kbd>
                        </td>
                        <td>{t('help.controls.escape')}</td>
                    </tr>
                </tbody>
            </table>

            <div className="sub-label">{t('help.scoring.heading')}</div>
            <p>{t('help.scoring.standard')}</p>
            <p>{t('help.scoring.vegas')}</p>

            <div className="sub-label">{t('help.winnable.heading')}</div>
            <p>{t('help.winnable.intro')}</p>
            <p>{t('help.winnable.grading')}</p>
            <dl className="help-grades">
                {GRADES.map((grade) => (
                    <div className="help-grades__row" key={grade.nameKey}>
                        <dt>
                            <strong>{t(grade.nameKey)}</strong>
                        </dt>
                        <dd>{t(grade.descriptionKey)}</dd>
                    </div>
                ))}
            </dl>
            <p>{t('help.winnable.difficulty')}</p>

            <div className="modal-sheet__actions">
                <button type="button" className="action-button action-button--filled" ref={gotItRef} onClick={dismiss}>
                    {t('help.gotIt')}
                </button>
            </div>
        </ModalSheet>
    );
}
