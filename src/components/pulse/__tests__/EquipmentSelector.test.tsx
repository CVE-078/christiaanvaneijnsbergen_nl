import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EquipmentSelector from '../EquipmentSelector';
import type { EquipmentKey } from '@/lib/pulse/types';

describe('EquipmentSelector', () => {
    it('renders all six equipment options', () => {
        render(<EquipmentSelector selected={new Set()} onToggle={() => {}} />);
        for (const label of ['Dumbbells', 'Barbell', 'Bench', 'Cables', 'Machine', 'Pull-up bar']) {
            expect(screen.getByText(label)).toBeInTheDocument();
        }
    });

    it('marks selected items pressed', () => {
        render(<EquipmentSelector selected={new Set<EquipmentKey>(['barbell'])} onToggle={() => {}} />);
        expect(screen.getByRole('button', { name: /Barbell/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /Dumbbells/ })).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onToggle with the key when clicked', async () => {
        const onToggle = vi.fn();
        render(<EquipmentSelector selected={new Set()} onToggle={onToggle} />);
        await userEvent.click(screen.getByRole('button', { name: /Cables/ }));
        expect(onToggle).toHaveBeenCalledWith('cables');
    });

    it('does not fire onToggle when disabled', async () => {
        const onToggle = vi.fn();
        render(<EquipmentSelector selected={new Set()} onToggle={onToggle} disabled />);
        await userEvent.click(screen.getByRole('button', { name: /Cables/ }));
        expect(onToggle).not.toHaveBeenCalled();
    });
});
