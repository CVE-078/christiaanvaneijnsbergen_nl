import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TemplatesTab from '../views/TemplatesTab';
import type { RoutineTemplate } from '@/lib/pulse/types';

vi.mock('swr', () => ({
    default: vi.fn(),
}));
vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

import useSWR from 'swr';
import { usePulse } from '@/context/PulseContext';

const mockCloneTemplate = vi.fn().mockResolvedValue({});
const mockNavigate = vi.fn();

const templates: RoutineTemplate[] = [
    {
        id: '1', name: 'Full Body — Dumbbells', slug: 'full-body-db',
        required_equipment: ['dumbbells'], days_per_week: '2-3',
        experience_level: 'beginner', session_time: '30-45 min',
        description: 'One session works everything.',
        schedule_pattern: ['full_body'],
        default_days: [1, 3, 5],
    },
    {
        id: '2', name: 'PPL — Gym', slug: 'ppl-gym',
        required_equipment: ['barbell','bench','cables','machines'], days_per_week: '3-6',
        experience_level: 'intermediate', session_time: '60-90 min',
        description: 'Classic PPL with full gym access.',
        schedule_pattern: ['push', 'pull', 'legs'],
        default_days: [1, 2, 3, 4, 5, 6],
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    (useSWR as any).mockReturnValue({ data: templates });
    (usePulse as any).mockReturnValue({
        cloneTemplate: mockCloneTemplate,
        navigate: mockNavigate,
        routines: [],
    });
});

describe('TemplatesTab', () => {
    it('renders all templates when filter is All', () => {
        render(<TemplatesTab />);
        expect(screen.getByText('Full Body — Dumbbells')).toBeInTheDocument();
        expect(screen.getByText('PPL — Gym')).toBeInTheDocument();
    });

    it('filters to dumbbells-only templates', () => {
        render(<TemplatesTab />);
        fireEvent.click(screen.getByText('Dumbbells'));
        expect(screen.getByText('Full Body — Dumbbells')).toBeInTheDocument();
        expect(screen.queryByText('PPL — Gym')).not.toBeInTheDocument();
    });

    it('clones template and navigates when no active routine', async () => {
        render(<TemplatesTab />);
        const buttons = screen.getAllByText('Use this');
        fireEvent.click(buttons[0]);
        await waitFor(() => expect(mockCloneTemplate).toHaveBeenCalledWith('full-body-db'));
        expect(mockNavigate).toHaveBeenCalledWith('log');
    });

    it('shows confirm dialog when user already has a routine', async () => {
        (usePulse as any).mockReturnValue({
            cloneTemplate: mockCloneTemplate,
            navigate: mockNavigate,
            routines: [{ id: 'r1', name: 'My Routine' }],
        });
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        render(<TemplatesTab />);
        fireEvent.click(screen.getAllByText('Use this')[0]);
        expect(confirmSpy).toHaveBeenCalled();
        expect(mockCloneTemplate).not.toHaveBeenCalled();
    });
});
