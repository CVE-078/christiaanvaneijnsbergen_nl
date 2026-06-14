import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordInput from '../PasswordInput';

describe('PasswordInput', () => {
    it('reaches the show/hide toggle by keyboard from the field and toggles visibility', async () => {
        render(<PasswordInput aria-label="Password" defaultValue="secret" />);
        const field = screen.getByLabelText('Password') as HTMLInputElement;
        expect(field.type).toBe('password');

        // Tabbing from the field lands on the toggle (it is in the tab order, not tabIndex=-1).
        field.focus();
        await userEvent.tab();
        const toggle = screen.getByRole('button', { name: /show password/i });
        expect(toggle).toHaveFocus();

        // Operating it from the keyboard reveals the value and flips the label.
        await userEvent.keyboard('{Enter}');
        expect(field.type).toBe('text');
        expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
    });
});
