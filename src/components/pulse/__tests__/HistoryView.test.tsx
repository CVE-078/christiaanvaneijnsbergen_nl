import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/context/PulseContext', () => ({
    usePulse: vi.fn(),
}));

vi.mock('@/app/pulse/actions', () => ({
    updateGoalWeight: vi.fn().mockResolvedValue(undefined),
    logBodyWeight: vi.fn().mockResolvedValue({ id: 'x', logged_at: '2026-06-12', weight_kg: 80 }),
    logBodyMeasurement: vi.fn().mockResolvedValue(undefined),
}));

import { usePulse } from '@/context/PulseContext';
import HistoryView from '../views/HistoryView';

// Minimal context with no session data (renders empty states).
const defaultContext = {
    logs: {},
    profile: {
        unit: 'kg' as const,
        gender: null,
        length_unit: 'cm' as const,
        priority_muscle: null,
        goal_weight_kg: null,
        timezone: 'UTC',
    },
    prMap: {},
    routines: [],
    streak: 0,
    activeWeek: 1,
    activeRoutine: null,
    programPosition: null,
    decisions: [],
    loading: {},
    errors: {},
    retry: vi.fn(),
    swaps: {},
    exercises: [],
    workoutSessions: [],
    bodyweightLogs: [],
    bodyMeasurements: [],
    refreshMeasurements: vi.fn(),
    logBodyWeight: vi.fn().mockResolvedValue({ id: 'x', logged_at: '2026-06-12', weight_kg: 80 }),
    deleteBodyWeight: vi.fn().mockResolvedValue(undefined),
    updateLengthUnit: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
    vi.mocked(usePulse).mockReturnValue(defaultContext as unknown as ReturnType<typeof usePulse>);
});

describe('HistoryView', () => {
    it('renders the three progress tabs', () => {
        render(<HistoryView />);
        expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Lifts' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Body' })).toBeInTheDocument();
    });

    it('defaults to the Overview tab (overview panel visible)', () => {
        render(<HistoryView />);
        // Overview panel is visible by default
        expect(screen.getByRole('tabpanel', { name: 'Overview' })).toBeInTheDocument();
        // Lifts and Body panels are not rendered in the DOM
        expect(screen.queryByRole('tabpanel', { name: 'Lifts' })).not.toBeInTheDocument();
        expect(screen.queryByRole('tabpanel', { name: 'Body' })).not.toBeInTheDocument();
    });

    it('switches to the Lifts tab and shows lifts content', async () => {
        render(<HistoryView />);
        await userEvent.click(screen.getByRole('tab', { name: 'Lifts' }));
        expect(screen.getByRole('tabpanel', { name: 'Lifts' })).toBeInTheDocument();
        // Lifts panel contains the "Best Lifts" section heading
        expect(screen.getByText('Best Lifts')).toBeInTheDocument();
        // Overview panel is no longer rendered
        expect(screen.queryByRole('tabpanel', { name: 'Overview' })).not.toBeInTheDocument();
    });

    it('switches to the Body tab and shows body weight logging control', async () => {
        render(<HistoryView />);
        await userEvent.click(screen.getByRole('tab', { name: 'Body' }));
        expect(screen.getByRole('tabpanel', { name: 'Body' })).toBeInTheDocument();
        // Body weight input is present
        expect(screen.getByRole('spinbutton', { name: /body weight in kg/i })).toBeInTheDocument();
    });

    it('switches to the Body tab and shows a measurements control', async () => {
        render(<HistoryView />);
        await userEvent.click(screen.getByRole('tab', { name: 'Body' }));
        // MeasurementsCard renders its metric picker pills
        expect(screen.getByRole('button', { name: /^waist$/i })).toBeInTheDocument();
    });

    it('shows the no-sessions empty state in the Lifts tab when there are no logs', async () => {
        render(<HistoryView />);
        await userEvent.click(screen.getByRole('tab', { name: 'Lifts' }));
        expect(screen.getByText(/no workouts yet/i)).toBeInTheDocument();
    });

    it('renders the page title "Progress"', () => {
        render(<HistoryView />);
        expect(screen.getByText('Progress')).toBeInTheDocument();
    });
});
