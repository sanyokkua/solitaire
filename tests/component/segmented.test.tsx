import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Segmented } from '../../src/ui/components/Segmented';

const OPTIONS = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
] as const;

describe('Segmented disabled', () => {
    it('shows the value, is exposed as disabled and never calls onChange', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Segmented label="Pick" options={OPTIONS} value="b" onChange={onChange} disabled />);

        expect(screen.getByRole('radiogroup', { name: 'Pick' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: 'Alpha' })).toBeDisabled();

        await user.click(screen.getByRole('radio', { name: 'Alpha' }));
        screen.getByRole('radio', { name: 'Beta' }).focus();
        await user.keyboard('{ArrowLeft}');

        expect(onChange).not.toHaveBeenCalled();
    });

    it('is not disabled by default', () => {
        render(<Segmented label="Pick" options={OPTIONS} value="a" onChange={vi.fn()} />);

        expect(screen.getByRole('radiogroup', { name: 'Pick' })).not.toHaveAttribute('aria-disabled');
        expect(screen.getByRole('radio', { name: 'Beta' })).toBeEnabled();
    });
});
