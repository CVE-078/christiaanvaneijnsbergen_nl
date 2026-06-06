import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/context/PulseContext', () => ({ usePulse: vi.fn() }));

import CoachPanel from '../CoachPanel';
import { usePulse } from '@/context/PulseContext';
import type { DecisionEventRow } from '@/lib/pulse/types';

const RE = '11111111-1111-4111-8111-111111111111';

const routines = [
    {
        id: 'r1',
        program_weeks: 12,
        exercises: [{ id: RE, exercise: { name: 'Barbell Row' } }],
    },
];

function ctx(decisions: DecisionEventRow[]) {
    vi.mocked(usePulse).mockReturnValue({
        decisions,
        routines,
        activeRoutine: routines[0],
        profile: { unit: 'kg' },
    } as unknown as ReturnType<typeof usePulse>);
}

function deload(over: Partial<DecisionEventRow> = {}): DecisionEventRow {
    return {
        id: 'd1',
        routine_id: 'r1',
        type: 'deload',
        trigger: 'plateau',
        affectedArea: RE,
        week: 6,
        magnitude: { fromKg: 70, toKg: 62.5 },
        confidence: null,
        created_at: '2026-06-06T10:00:00.000Z',
        ...over,
    };
}

beforeEach(() => vi.clearAllMocks());

describe('CoachPanel', () => {
    it('renders nothing when there are no decisions', () => {
        ctx([]);
        const { container } = render(<CoachPanel />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows the compact card with the resolved exercise name', () => {
        ctx([deload()]);
        render(<CoachPanel />);
        expect(screen.getByText('Barbell Row deloaded')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /view all decisions/i })).toBeInTheDocument();
    });

    it('opens the full timeline overlay with the week header and the "what next" line', async () => {
        ctx([deload()]);
        render(<CoachPanel />);
        await userEvent.click(screen.getByRole('button', { name: /view all decisions/i }));
        const dialog = screen.getByRole('dialog', { name: /coach decision timeline/i });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByText(/Week 6/)).toBeInTheDocument();
        expect(screen.getByText(/break the plateau/i)).toBeInTheDocument();
    });

    it('closes the overlay with the close button', async () => {
        ctx([deload()]);
        render(<CoachPanel />);
        await userEvent.click(screen.getByRole('button', { name: /view all decisions/i }));
        await userEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
