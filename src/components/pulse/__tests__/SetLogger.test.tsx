import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetLogger from '../SetLogger';
import type { LogEntry } from '@/lib/pulse/types';

const defaultProps = {
    exIdx: 0,
    setIdx: 0,
    week: 1,
    type: 'push' as const,
    entry: undefined,
    unit: 'kg' as const,
    onSave: vi.fn(),
};

describe('SetLogger', () => {
    it('renders kg and reps inputs and a Save button when not saved', () => {
        render(<SetLogger {...defaultProps} />);
        expect(screen.getByRole('spinbutton', { name: /weight in kg/i })).toBeInTheDocument();
        expect(screen.getByRole('spinbutton', { name: /repetitions/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    it('shows the saved value and no Save button when entry is saved', () => {
        const savedEntry: LogEntry = { kg: 60, reps: 10, rir: 3, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} />);
        expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
        expect(screen.getByText(/60 kg/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('pre-fills inputs with saved values when Edit is clicked', async () => {
        const savedEntry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} />);
        await userEvent.click(screen.getByRole('button', { name: /edit/i }));
        expect(screen.getByRole('spinbutton', { name: /weight in kg/i })).toHaveValue(80);
        expect(screen.getByRole('spinbutton', { name: /repetitions/i })).toHaveValue(8);
    });

    it('Cancel resets inputs to saved values and hides the Cancel button', async () => {
        const savedEntry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} />);
        await userEvent.click(screen.getByRole('button', { name: /edit/i }));
        const kgInput = screen.getByRole('spinbutton', { name: /weight in kg/i });
        await userEvent.clear(kgInput);
        await userEvent.type(kgInput, '999');
        await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
        // Back to saved view â€” no Cancel button visible
        expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
        expect(screen.getByText(/80 kg/)).toBeInTheDocument();
    });

    it('calls onSave with a valid LogEntry when Save is clicked', async () => {
        const onSave = vi.fn();
        render(<SetLogger {...defaultProps} onSave={onSave} />);

        await userEvent.type(screen.getByRole('spinbutton', { name: /weight in kg/i }), '60');
        await userEvent.type(screen.getByRole('spinbutton', { name: /repetitions/i }), '10');
        await userEvent.click(screen.getByRole('button', { name: /save/i }));

        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ kg: 60, reps: 10, saved: true }));
    });

    it('does not call onSave when inputs are empty', async () => {
        const onSave = vi.fn();
        render(<SetLogger {...defaultProps} onSave={onSave} />);
        await userEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(onSave).not.toHaveBeenCalled();
    });

    it('calls onDelete when the delete button is clicked', async () => {
        const onDelete = vi.fn();
        const savedEntry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} onDelete={onDelete} />);
        await userEvent.click(screen.getByRole('button', { name: /✕/i }));
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('displays the RIR target for the given week', () => {
        render(<SetLogger {...defaultProps} week={9} />); // week 9 â†’ RIR 0
        expect(screen.getByText(/^0\s+RIR$/)).toBeInTheDocument();
    });

    it('shows previous week reference when previousEntry is provided and set is unsaved', () => {
        const prev: LogEntry = { kg: 60, reps: 8, rir: 3, saved: true };
        render(<SetLogger {...defaultProps} previousEntry={prev} />);
        expect(screen.getByText(/60 kg × 8/)).toBeInTheDocument();
    });

    it('pre-fills kg input with suggested weight when previous RIR exceeded target', () => {
        // week 2, prevTarget = getRIR(1) = 3, prev.rir = 4 > 3 â†’ +2.5 â†’ 62.5
        const prev: LogEntry = { kg: 60, reps: 8, rir: 4, saved: true };
        render(<SetLogger {...defaultProps} week={2} previousEntry={prev} />);
        expect(screen.getByRole('spinbutton', { name: /weight in kg/i })).toHaveValue(62.5);
    });

    it('shows PR badge when isPR is true and entry is saved', () => {
        const savedEntry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} isPR={true} />);
        expect(screen.getByText('PR')).toBeInTheDocument();
    });

    it('does not show PR badge when isPR is false', () => {
        const savedEntry: LogEntry = { kg: 80, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} isPR={false} />);
        expect(screen.queryByText('PR')).not.toBeInTheDocument();
    });

    it('shows the plate calculator affordance on a saved set above the handle weight', () => {
        const savedEntry: LogEntry = { kg: 60, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} />);
        expect(screen.getByRole('button', { name: /plate calculator/i })).toBeInTheDocument();
    });

    it('hides the plate calculator affordance when no weight is entered', () => {
        render(<SetLogger {...defaultProps} />);
        expect(screen.queryByRole('button', { name: /plate calculator/i })).not.toBeInTheDocument();
    });

    it('opens the plate calculator and shows per-side chips for the target weight', async () => {
        const savedEntry: LogEntry = { kg: 100, reps: 8, rir: 2, saved: true };
        render(<SetLogger {...defaultProps} entry={savedEntry} />);
        await userEvent.click(screen.getByRole('button', { name: /plate calculator/i }));
        expect(screen.getByText(/per side/i)).toBeInTheDocument();
        // 100 kg barbell -> 40 per side -> [25, 15]
        expect(screen.getByText(/25 kg/)).toBeInTheDocument();
    });
});
